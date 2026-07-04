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
import { TagCommentsService } from '../taxonomy/tag-comments.service';
import { TaxonomyService } from '../taxonomy/taxonomy.service';
import { mergeTagIds } from '../taxonomy/tags';
import { ReviewService } from '../review/review.service';
import { QueueService } from '../queue/queue.service';
import { AuditService } from '../audit/audit.service';
import { configFingerprint, contentHash, tagHintsDigest } from './fingerprint';
import { DeferJobError } from './defer-job.error';
import { PromptsService } from '../prompts/prompts.service';
import { extractionVars, ocrVars } from '../prompts/render';

export type Decision = 'auto-applied' | 'review-queued' | 'ocr-only' | 'skipped';

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
    private readonly tagComments: TagCommentsService,
    private readonly review: ReviewService,
    private readonly queue: QueueService,
    private readonly audit: AuditService,
    private readonly prompts: PromptsService,
  ) {}

  async process(job: Job, signal?: AbortSignal): Promise<ProcessResult> {
    const client = this.connection.getClient();
    if (!client) throw new Error('No paperless connection is configured.');

    const settings = this.settings.get();
    // `null` = extraction is off (OCR-only mode) — no LLM model is required then.
    const provider = settings.extractionEnabled
      ? this.resolveProvider(settings.llmProviderId, settings.llmModel, 'LLM')
      : null;

    const doc = await client.getDocument(job.documentId);
    const triggerTagId = await this.taxonomy.resolveTriggerTag(client);

    // --- Step 2: page-based cost gates. `page_count` comes straight from paperless;
    // when it's unknown (null) no gate applies — we can't prove the file is oversized. ---
    const pageCount = doc.page_count ?? null;
    const overLimit = (limit: number | null) =>
      limit != null && pageCount != null && pageCount > limit;

    // The extraction limit is the OUTER gate: a document too large to extract gets
    // neither OCR nor extraction. We leave whatever paperless already recognised,
    // drop the trigger tag so it isn't re-polled, and record the skip. Re-tagging it
    // (or raising the limit) is the explicit "process me anyway" signal. With
    // extraction off the gate doesn't apply — only the OCR limit governs then.
    if (settings.extractionEnabled && overLimit(settings.extractMaxPages)) {
      await this.dropTriggerTags(client, doc, triggerTagId);
      this.audit.record({ jobId: job.id, documentId: job.documentId, decision: 'skipped' });
      // A previous attempt may have OCR'd before the limit was lowered — the
      // gate settles the job, so honour the cache's evict-on-settle contract.
      this.ocrCache.delete(job.documentId);
      this.logger.log(
        `job ${job.id} (doc ${job.documentId}) skipped: ${pageCount} pages over the extraction limit (${settings.extractMaxPages})`,
      );
      // A sentinel hash that can never equal a real completion's hash (those are
      // `<version>|llm:…|ocr:…`). Raising the limit and re-tagging must reprocess —
      // it must not look "already done". The page gate itself suppresses redundant
      // reruns while the document is still oversized.
      return { contentHash: contentHash(String(pageCount), 'skipped:oversized'), cost: null, decision: 'skipped' };
    }

    // --- Step 3: OCR. Run it only when enabled, an OCR model is selected, AND the
    // document is within the OCR page limit; otherwise reuse paperless's existing
    // Tesseract text (free). ---
    const ocrModelSelected = settings.ocrProviderId != null && !!settings.ocrModel;
    if (settings.extractionEnabled && settings.ocrEnabled && !ocrModelSelected) {
      // Don't fail the job over a missing model — degrade to paperless's text and
      // say so. The Processing UI also disables the OCR controls until a model is set.
      this.logger.warn(
        `job ${job.id} (doc ${job.documentId}): OCR is on but no OCR model is selected — using paperless's existing text. Pick an OCR model in Settings → Processing.`,
      );
    }
    const runOcr = settings.ocrEnabled && ocrModelSelected && !overLimit(settings.ocrMaxPages);

    // OCR-only mode with no runnable OCR step: nothing this pipeline can do.
    // Over the page limit that mirrors the extraction gate above (skip + drop
    // the trigger tag; raising the limit and re-tagging reprocesses). Anything
    // else is a config dead end — fail the job loudly (it goes terminal and
    // shows on the dashboard) instead of silently un-tagging documents.
    if (!settings.extractionEnabled && !runOcr) {
      if (settings.ocrEnabled && ocrModelSelected) {
        await this.dropTriggerTags(client, doc, triggerTagId);
        this.audit.record({ jobId: job.id, documentId: job.documentId, decision: 'skipped' });
        // As above: a prior attempt's cached OCR must not outlive the settled job.
        this.ocrCache.delete(job.documentId);
        this.logger.log(
          `job ${job.id} (doc ${job.documentId}) skipped: ${pageCount} pages over the OCR limit (${settings.ocrMaxPages}) and extraction is off`,
        );
        return { contentHash: contentHash(String(pageCount), 'skipped:oversized'), cost: null, decision: 'skipped' };
      }
      const fix = !settings.ocrEnabled ? 'enable OCR' : 'select an OCR model';
      throw new Error(
        `Extraction is disabled and OCR cannot run — ${fix} in Settings → Processing, or re-enable extraction.`,
      );
    }
    const existing = (doc.content ?? '').trim();
    let ocrProvider: ResolvedProvider | null = null;
    let ocrUsage: LlmUsage | undefined;
    let text: string;

    if (runOcr) {
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
        // burn every attempt back-to-back before the text exists (see worker). Point
        // at whichever knob is actually blocking OCR so the message isn't misleading.
        const fix = !settings.ocrEnabled
          ? 'enable OCR'
          : !ocrModelSelected
            ? 'select an OCR model'
            : 'raise the OCR page limit';
        throw new DeferJobError(`Document has no text yet — ${fix} or wait for paperless to OCR it.`);
      }
    }

    // --- Step 4: fingerprint (post-OCR text + full config) + skip check. ---
    // Tag hints shape the extraction prompt, so they're part of the fingerprint
    // (only while extraction runs): editing a hint and re-tagging a document
    // must re-run it, not skip-as-identical.
    const tagHints = provider ? this.tagComments.map() : new Map<number, string>();
    const fingerprint = configFingerprint({
      llm: provider ? { kind: provider.kind, model: provider.model } : null,
      ocr: ocrProvider ? { kind: ocrProvider.kind, model: ocrProvider.model } : null,
      hintsDigest: tagHintsDigest(tagHints),
    });
    const hash = contentHash(text, fingerprint);

    // Skip a byte-for-byte-identical rerun (same text + same config fingerprint):
    // an identical result was already produced, so clear the trigger tag so the
    // document isn't re-polled forever. The completed run wrote this OCR text
    // back then, but paperless's `content` may have drifted since (paperless
    // re-OCR, manual edit) — restore it in the same PATCH, or an explicit re-tag
    // would bill OCR and change nothing. No pending review item can exist at
    // this point (the poller's pending-check guards against re-enqueuing one).
    // We still report any OCR tokens we just spent computing the hash.
    if (this.queue.hasCompletedWithHash(job.documentId, hash)) {
      const tags = doc.tags.filter((id) => id !== triggerTagId);
      const patch: DocumentPatch = {};
      if (runOcr && text !== existing) patch.content = text;
      if (tags.length !== doc.tags.length) patch.tags = tags;
      if (Object.keys(patch).length > 0) await client.patchDocument(doc.id, patch);
      this.audit.record({ jobId: job.id, documentId: job.documentId, decision: 'skipped' });
      this.ocrCache.delete(job.documentId);
      return { contentHash: hash, cost: ocrUsage?.totalTokens ?? null, decision: 'skipped' };
    }

    // OCR text replaces the document's `content`; it is not a reviewable suggestion.
    // Write it back only when it actually changed, to avoid a needless re-index PATCH.
    const ocrChanged = runOcr && text !== existing;

    // OCR-only mode: the run is complete once the text is written back. Fold the
    // content write-back and the trigger-tag drop into a single PATCH (one
    // re-index), the same way applyAuto folds them into the metadata PATCH.
    if (!provider) {
      const tags = doc.tags.filter((id) => id !== triggerTagId);
      const patch: DocumentPatch = {};
      if (ocrChanged) patch.content = text;
      if (tags.length !== doc.tags.length) patch.tags = tags;
      if (Object.keys(patch).length > 0) await client.patchDocument(doc.id, patch);
      const cost = ocrUsage?.totalTokens ?? null;
      this.audit.record({ jobId: job.id, documentId: job.documentId, tokensCost: cost, decision: 'ocr-only' });
      this.ocrCache.delete(job.documentId);
      return { contentHash: hash, cost, decision: 'ocr-only' };
    }

    const snap = await this.taxonomy.getSnapshot(client);
    const isTrigger = (id: number) => id === triggerTagId;
    const tagName = (id: number) => snap.tags.find((t) => t.id === id)?.name;
    const prompt = this.prompts.render(
      PROMPT_KEY.EXTRACTION,
      extractionVars({
        content: text,
        language: settings.language,
        allTags: snap.tags
          .filter((t) => !isTrigger(t.id))
          .map((t) => ({ name: t.name, comment: tagHints.get(t.id) ?? null })),
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

    // A single trigger tag drives the pipeline; the auto-apply setting alone
    // decides whether to write immediately or queue the suggestion for review.
    const isAuto = settings.autoApply;
    // Only create new entities without a human gate (auto mode), and only the
    // kinds the user opted into — tags and correspondents are gated separately.
    const createTags = isAuto && settings.createNewTags;
    const createCorrespondents = isAuto && settings.createNewCorrespondents;

    // Resolve against the same snapshot the prompt was rendered from: a Tags-page
    // edit during the (long) LLM call must not shift the ground under this job —
    // e.g. a rename would otherwise re-create the old name as a duplicate tag.
    const resolvedTags = await this.taxonomy.resolveTags(client, extraction.tags, {
      create: createTags,
      snapshot: snap,
    });
    const resolvedCorrespondent = await this.taxonomy.resolveCorrespondent(
      client,
      extraction.correspondent,
      { create: createCorrespondents, blacklist: settings.correspondentBlacklist, snapshot: snap },
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
        triggerTagId,
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
    triggerTagId: number,
    /** New OCR text to write back in the same PATCH, when it changed. */
    content?: string,
  ): Promise<void> {
    const addIds = s.resolvedTags.map((t) => t.id).filter((id): id is number => id != null);
    const patch: DocumentPatch = {
      title: s.extraction.title,
      // Merge suggested tags with the current ones and drop the trigger tag in
      // the same PATCH — tag-replace semantics, never a blind overwrite.
      tags: mergeTagIds(doc.tags, addIds, [triggerTagId]),
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
    triggerTagId: number,
  ): Promise<void> {
    const tags = doc.tags.filter((id) => id !== triggerTagId);
    if (tags.length !== doc.tags.length) await client.patchDocument(doc.id, { tags });
  }
}
