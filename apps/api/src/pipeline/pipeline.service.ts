import { Injectable, Logger } from '@nestjs/common';
import {
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
import { LlmService } from '../providers/llm.service';
import { buildLanguageModel, type ResolvedProvider } from '../providers/model.factory';
import { SettingsService } from '../settings/settings.service';
import { TaxonomyService } from '../taxonomy/taxonomy.service';
import { mergeTagIds } from '../taxonomy/tags';
import { ReviewService } from '../review/review.service';
import { QueueService } from '../queue/queue.service';
import { AuditService } from '../audit/audit.service';
import { configFingerprint, contentHash } from './fingerprint';
import { DeferJobError } from './defer-job.error';
import {
  buildExtractionPrompt,
  EXTRACTION_SCHEMA_DESCRIPTION,
  EXTRACTION_SCHEMA_NAME,
} from './prompt';

export type Decision = 'auto-applied' | 'review-queued' | 'skipped';

export interface ProcessResult {
  contentHash: string;
  /** Total tokens for the run, or null when no LLM call happened (skip). */
  cost: number | null;
  decision: Decision;
}

/**
 * Per-document orchestration (§6, OCR deferred to M5). Pure-ish: it reads/writes
 * paperless, the review queue and the audit log, and returns the content hash +
 * cost for the worker to record on the job. It does not touch job lifecycle.
 */
@Injectable()
export class PipelineService {
  private readonly logger = new Logger(PipelineService.name);

  constructor(
    private readonly connection: ConnectionService,
    private readonly providers: ProviderService,
    private readonly settings: SettingsService,
    private readonly llm: LlmService,
    private readonly taxonomy: TaxonomyService,
    private readonly review: ReviewService,
    private readonly queue: QueueService,
    private readonly audit: AuditService,
  ) {}

  async process(job: Job, signal?: AbortSignal): Promise<ProcessResult> {
    const client = this.connection.getClient();
    if (!client) throw new Error('No paperless connection is configured.');

    const settings = this.settings.get();
    const provider = this.resolveProvider(settings.llmProviderId, settings.llmModel);

    const doc = await client.getDocument(job.documentId);
    // M3 relies on paperless's existing OCR text; OCR write-back lands in M5.
    const text = (doc.content ?? '').trim();
    if (!text) {
      // Not a failure — paperless likely hasn't OCR'd it yet. Defer so we don't
      // burn every attempt back-to-back before the text exists (see worker).
      throw new DeferJobError(
        'Document has no text yet — enable OCR or wait for paperless to OCR it.',
      );
    }

    const fingerprint = configFingerprint({ providerKind: provider.kind, model: provider.model });
    const hash = contentHash(text, fingerprint);
    const { reviewTagId, autoTagId } = await this.taxonomy.resolveTriggerTags(client);

    // Skip a byte-for-byte-identical rerun (same text + same config fingerprint).
    // An identical result was already produced, so just clear the trigger tag so
    // the document isn't re-polled forever. No pending review item can exist at
    // this point — the poller's pending-check guards against re-enqueuing one.
    if (this.queue.hasCompletedWithHash(job.documentId, hash)) {
      await this.dropTriggerTags(client, doc, reviewTagId, autoTagId);
      this.audit.record({ jobId: job.id, documentId: job.documentId, decision: 'skipped' });
      return { contentHash: hash, cost: null, decision: 'skipped' };
    }

    const snap = await this.taxonomy.getSnapshot(client);
    const isTrigger = (id: number) => id === reviewTagId || id === autoTagId;
    const { system, prompt } = buildExtractionPrompt({
      content: text,
      language: settings.language,
      tags: snap.tags.filter((t) => !isTrigger(t.id)).map((t) => t.name),
      correspondents: snap.correspondents.map((c) => c.name),
    });

    const { object: extraction, usage } = await this.llm.generateStructured<Extraction>({
      model: buildLanguageModel(provider),
      schema: extractionSchema,
      schemaName: EXTRACTION_SCHEMA_NAME,
      schemaDescription: EXTRACTION_SCHEMA_DESCRIPTION,
      system,
      prompt,
      abortSignal: signal,
    });
    const cost = usage.totalTokens;

    // Explicit auto tag wins; otherwise the global auto-apply setting decides.
    const isAuto = doc.tags.includes(autoTagId) || settings.autoApply;
    // Only create new tags/correspondents without a human gate (auto mode).
    const create = isAuto && settings.createNewTags;

    const resolvedTags = await this.taxonomy.resolveTags(client, extraction.tags, { create });
    const resolvedCorrespondent = await this.taxonomy.resolveCorrespondent(
      client,
      extraction.correspondent,
      { create, blacklist: settings.correspondentBlacklist },
    );

    const auditBase = {
      jobId: job.id,
      documentId: job.documentId,
      prompt: `${system}\n\n${prompt}`,
      rawOutput: JSON.stringify(extraction),
      result: extraction,
      tokensCost: cost,
    };

    if (isAuto) {
      await this.applyAuto(client, doc, { extraction, resolvedTags, resolvedCorrespondent }, reviewTagId, autoTagId);
      this.audit.record({ ...auditBase, decision: 'auto-applied' });
      return { contentHash: hash, cost, decision: 'auto-applied' };
    }

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
    return { contentHash: hash, cost, decision: 'review-queued' };
  }

  private resolveProvider(llmProviderId: number | null, llmModel: string | null): ResolvedProvider {
    if (llmProviderId == null || !llmModel) {
      throw new Error('No LLM model selected — choose one in Settings → Processing.');
    }
    const credential = this.providers.getCredential(llmProviderId);
    if (!credential) {
      throw new Error('The selected LLM provider no longer exists — pick another in Settings.');
    }
    return { ...credential, model: llmModel };
  }

  private async applyAuto(
    client: PaperlessClient,
    doc: PaperlessDocument,
    s: { extraction: Extraction; resolvedTags: ResolvedTag[]; resolvedCorrespondent: ResolvedTag | null },
    reviewTagId: number,
    autoTagId: number,
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
