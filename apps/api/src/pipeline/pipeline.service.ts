import { Injectable, Logger } from '@nestjs/common';
import {
  EXTRACTION_SCHEMA_DESCRIPTION,
  EXTRACTION_SCHEMA_NAME,
  PROMPT_KEY,
  extractionSchema,
  type Extraction,
  type ResolvedTag,
  type ReviewSuggestions,
} from '@paperless-starfruit/shared';
import type { Job } from '../db/schema';
import type { DocumentPatch, PaperlessClient } from '../paperless/paperless.client';
import type { PaperlessDocument } from '../paperless/paperless.schemas';
import { ConnectionService } from '../connection/connection.service';
import { ProviderService } from '../providers/provider.service';
import { LlmService, type LlmUsage } from '../providers/llm.service';
import { OcrService } from '../providers/ocr.service';
import { buildLanguageModel, type ResolvedProvider } from '../providers/model.factory';
import { SettingsService } from '../settings/settings.service';
import { TaxonomyService } from '../taxonomy/taxonomy.service';
import { mergeTagIds } from '../taxonomy/tags';
import { ReviewService } from '../review/review.service';
import { QueueService } from '../queue/queue.service';
import { AuditService } from '../audit/audit.service';
import { configFingerprint, contentHash } from './fingerprint';
import { DeferJobError } from './defer-job.error';
import { PromptsService } from '../prompts/prompts.service';
import { extractionVars, ocrVars } from '../prompts/render';

export type Decision = 'auto-applied' | 'review-queued' | 'skipped';

export interface ProcessResult {
  contentHash: string;
  /** Total tokens for the run, or null when no LLM call happened (skip). */
  cost: number | null;
  decision: Decision;
}

/**
 * Per-document orchestration (§6). Pure-ish: it reads/writes paperless, the review
 * queue and the audit log, and returns the content hash + cost for the worker to
 * record on the job. It does not touch job lifecycle.
 */
@Injectable()
export class PipelineService {
  private readonly logger = new Logger(PipelineService.name);

  /**
   * Last successful OCR per document, so a failure in a *later* step (LLM call,
   * tag creation, the re-index-heavy PATCH) doesn't re-download and re-bill OCR
   * when the worker retries the job. Keyed by document id + OCR provider/model;
   * evicted once the job settles. Bounded by in-flight docs (worker concurrency
   * is 1) and lost on restart — at most one re-OCR, never a permanent leak of work.
   */
  private readonly ocrCache = new Map<number, { key: string; text: string; usage?: LlmUsage }>();

  constructor(
    private readonly connection: ConnectionService,
    private readonly providers: ProviderService,
    private readonly settings: SettingsService,
    private readonly llm: LlmService,
    private readonly ocr: OcrService,
    private readonly taxonomy: TaxonomyService,
    private readonly review: ReviewService,
    private readonly queue: QueueService,
    private readonly audit: AuditService,
    private readonly prompts: PromptsService,
  ) {}

  async process(job: Job, signal?: AbortSignal): Promise<ProcessResult> {
    const client = this.connection.getClient();
    if (!client) throw new Error('No paperless connection is configured.');

    const settings = this.settings.get();
    const provider = this.resolveProvider(settings.llmProviderId, settings.llmModel, 'LLM');

    const doc = await client.getDocument(job.documentId);

    // --- Step 2: OCR (single on/off toggle). When on, OCR the original and use
    // that text; when off, reuse paperless's existing Tesseract text (free). ---
    const existing = (doc.content ?? '').trim();
    let ocrProvider: ResolvedProvider | null = null;
    let ocrUsage: LlmUsage | undefined;
    let text: string;

    if (settings.ocrEnabled) {
      ocrProvider = this.resolveProvider(settings.ocrProviderId, settings.ocrModel, 'OCR');
      const ocrKey = `${ocrProvider.kind}/${ocrProvider.model}`;
      const cached = this.ocrCache.get(job.documentId);
      if (cached?.key === ocrKey) {
        // A previous attempt already OCR'd this exact document+config and then
        // failed downstream — reuse it instead of paying for OCR again.
        text = cached.text;
        ocrUsage = cached.usage;
      } else {
        const file = await client.downloadOriginal(job.documentId);
        const ocrPrompt = this.prompts.render(
          PROMPT_KEY.OCR,
          ocrVars({ language: settings.language, filename: doc.original_file_name ?? null }),
        );
        const result = await this.ocr.ocr(
          ocrProvider,
          { data: file.data, contentType: file.contentType },
          { language: settings.language, prompt: ocrPrompt, signal },
        );
        text = result.text.trim();
        ocrUsage = result.usage;
        // The original IS present (we just downloaded it), so empty OCR means the
        // page is blank/unreadable — a real failure, not a "not ready yet" defer.
        // Failing consumes attempts and eventually goes terminal, instead of
        // re-OCR'ing (and re-billing) the same blank page every poll.
        if (!text) throw new Error('OCR produced no text — the document may be blank or unreadable.');
        this.ocrCache.set(job.documentId, { key: ocrKey, text, usage: ocrUsage });
      }
    } else {
      text = existing;
      if (!text) {
        // Not a failure — paperless likely hasn't OCR'd it yet. Defer so we don't
        // burn every attempt back-to-back before the text exists (see worker).
        throw new DeferJobError(
          'Document has no text yet — enable OCR or wait for paperless to OCR it.',
        );
      }
    }

    // --- Step 3: fingerprint (post-OCR text + full config) + skip check. ---
    const fingerprint = configFingerprint({
      llm: { kind: provider.kind, model: provider.model },
      ocr: ocrProvider ? { kind: ocrProvider.kind, model: ocrProvider.model } : null,
    });
    const hash = contentHash(text, fingerprint);
    const { reviewTagId, autoTagId } = await this.taxonomy.resolveTriggerTags(client);

    // Skip a byte-for-byte-identical rerun (same text + same config fingerprint).
    // An identical result was already produced — and that run already wrote this
    // exact OCR text back — so just clear the trigger tag so the document isn't
    // re-polled forever. No pending review item can exist at this point (the
    // poller's pending-check guards against re-enqueuing one). We still report any
    // OCR tokens we just spent computing the hash.
    if (this.queue.hasCompletedWithHash(job.documentId, hash)) {
      await this.dropTriggerTags(client, doc, reviewTagId, autoTagId);
      this.audit.record({ jobId: job.id, documentId: job.documentId, decision: 'skipped' });
      this.ocrCache.delete(job.documentId);
      return { contentHash: hash, cost: ocrUsage?.totalTokens ?? null, decision: 'skipped' };
    }

    // OCR text replaces the document's `content`; it is not a reviewable suggestion.
    // Write it back only when it actually changed, to avoid a needless re-index PATCH.
    const ocrChanged = settings.ocrEnabled && text !== existing;

    const snap = await this.taxonomy.getSnapshot(client);
    const isTrigger = (id: number) => id === reviewTagId || id === autoTagId;
    const tagName = (id: number) => snap.tags.find((t) => t.id === id)?.name;
    const prompt = this.prompts.render(
      PROMPT_KEY.EXTRACTION,
      extractionVars({
        content: text,
        language: settings.language,
        allTags: snap.tags.filter((t) => !isTrigger(t.id)).map((t) => t.name),
        allCorrespondents: snap.correspondents.map((c) => c.name),
        // The prompt reflects the user's intent (the raw setting), not the
        // auto-gated `create` below — so in review mode the model still proposes
        // new tags/correspondents the human can approve.
        allowNewTags: settings.createNewTags,
        allowNewCorrespondents: settings.createNewCorrespondents,
        currentTitle: doc.title,
        currentTags: doc.tags
          .filter((id) => !isTrigger(id))
          .map(tagName)
          .filter((n): n is string => !!n),
        currentCorrespondent:
          snap.correspondents.find((c) => c.id === doc.correspondent)?.name ?? null,
        created: doc.created ? doc.created.slice(0, 10) : null,
        filename: doc.original_file_name ?? null,
      }),
    );

    const { object: extraction, usage } = await this.llm.generateStructured<Extraction>({
      model: buildLanguageModel(provider),
      schema: extractionSchema,
      schemaName: EXTRACTION_SCHEMA_NAME,
      schemaDescription: EXTRACTION_SCHEMA_DESCRIPTION,
      prompt,
      abortSignal: signal,
    });
    // Total cost for the run = extraction tokens + any vision-LLM OCR tokens.
    // Page-billed OCR (Mistral) carries no token usage, so it adds nothing here.
    const cost = usage.totalTokens + (ocrUsage?.totalTokens ?? 0);

    // Explicit auto tag wins; otherwise the global auto-apply setting decides.
    const isAuto = doc.tags.includes(autoTagId) || settings.autoApply;
    // Only create new entities without a human gate (auto mode), and only the
    // kinds the user opted into — tags and correspondents are gated separately.
    const createTags = isAuto && settings.createNewTags;
    const createCorrespondents = isAuto && settings.createNewCorrespondents;

    const resolvedTags = await this.taxonomy.resolveTags(client, extraction.tags, {
      create: createTags,
    });
    const resolvedCorrespondent = await this.taxonomy.resolveCorrespondent(
      client,
      extraction.correspondent,
      { create: createCorrespondents, blacklist: settings.correspondentBlacklist },
    );

    const auditBase = {
      jobId: job.id,
      documentId: job.documentId,
      prompt,
      rawOutput: JSON.stringify(extraction),
      result: extraction,
      tokensCost: cost,
    };

    if (isAuto) {
      // Fold the OCR write-back into the single metadata PATCH (one re-index).
      await this.applyAuto(
        client,
        doc,
        { extraction, resolvedTags, resolvedCorrespondent },
        reviewTagId,
        autoTagId,
        ocrChanged ? text : undefined,
      );
      this.audit.record({ ...auditBase, decision: 'auto-applied' });
      this.ocrCache.delete(job.documentId);
      return { contentHash: hash, cost, decision: 'auto-applied' };
    }

    // Review mode: the metadata waits on approval, but the OCR text is not a
    // reviewable suggestion — write it back now so the review preview shows it.
    if (ocrChanged) await client.patchDocument(doc.id, { content: text });

    const suggestions: ReviewSuggestions = {
      title: extraction.title,
      tags: resolvedTags,
      correspondent: resolvedCorrespondent,
      date: extraction.date,
      current: {
        title: doc.title,
        tagNames: await this.taxonomy.tagNames(client, doc.tags.filter((id) => !isTrigger(id))),
        correspondentName: await this.taxonomy.correspondentName(client, doc.correspondent),
        date: doc.created ? doc.created.slice(0, 10) : null,
      },
    };
    this.review.create(job.id, job.documentId, suggestions);
    this.audit.record({ ...auditBase, decision: 'review-queued' });
    this.ocrCache.delete(job.documentId);
    return { contentHash: hash, cost, decision: 'review-queued' };
  }

  private resolveProvider(
    providerId: number | null,
    model: string | null,
    role: 'LLM' | 'OCR',
  ): ResolvedProvider {
    if (providerId == null || !model) {
      throw new Error(
        role === 'OCR'
          ? 'OCR is on but no OCR model is selected — choose one in Settings → Processing, or turn OCR off.'
          : 'No LLM model selected — choose one in Settings → Processing.',
      );
    }
    const credential = this.providers.getCredential(providerId);
    if (!credential) {
      throw new Error(`The selected ${role} provider no longer exists — pick another in Settings.`);
    }
    return { ...credential, model };
  }

  private async applyAuto(
    client: PaperlessClient,
    doc: PaperlessDocument,
    s: { extraction: Extraction; resolvedTags: ResolvedTag[]; resolvedCorrespondent: ResolvedTag | null },
    reviewTagId: number,
    autoTagId: number,
    /** New OCR text to write back in the same PATCH, when it changed. */
    content?: string,
  ): Promise<void> {
    const addIds = s.resolvedTags.map((t) => t.id).filter((id): id is number => id != null);
    const patch: DocumentPatch = {
      title: s.extraction.title,
      // Merge suggested tags with the current ones and drop the trigger tags in
      // the same PATCH — tag-replace semantics, never a blind overwrite.
      tags: mergeTagIds(doc.tags, addIds, [reviewTagId, autoTagId]),
    };
    if (s.resolvedCorrespondent?.id != null) patch.correspondent = s.resolvedCorrespondent.id;
    // Send a date-only value: a UTC-midnight datetime would render a day early
    // on UTC-behind servers (paperless stores `created` in the server timezone).
    if (s.extraction.date) patch.created = s.extraction.date;
    if (content !== undefined) patch.content = content;
    await client.patchDocument(doc.id, patch);
  }

  private async dropTriggerTags(
    client: PaperlessClient,
    doc: PaperlessDocument,
    reviewTagId: number,
    autoTagId: number,
  ): Promise<void> {
    const tags = doc.tags.filter((id) => id !== reviewTagId && id !== autoTagId);
    if (tags.length !== doc.tags.length) await client.patchDocument(doc.id, { tags });
  }
}
