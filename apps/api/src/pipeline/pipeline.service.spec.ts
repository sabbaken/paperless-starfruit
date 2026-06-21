import { describe, expect, it, vi } from 'vitest';
import type { Settings } from '@paperless-starfruit/shared';
import type { Job } from '../db/schema';
import { DeferJobError } from './defer-job.error';
import type { PaperlessDocument } from '../paperless/paperless.schemas';
import type { ConnectionService } from '../connection/connection.service';
import type { ProviderService } from '../providers/provider.service';
import type { SettingsService } from '../settings/settings.service';
import type { LlmService } from '../providers/llm.service';
import type { TaxonomyService } from '../taxonomy/taxonomy.service';
import type { ReviewService } from '../review/review.service';
import type { QueueService } from '../queue/queue.service';
import type { AuditService } from '../audit/audit.service';
import { PipelineService } from './pipeline.service';

const REVIEW_TAG = 100;
const AUTO_TAG = 101;
const JOB: Job = { id: 1, documentId: 5 } as Job;

const DEFAULT_SETTINGS: Settings = {
  pollIntervalSec: 60,
  autoApply: false,
  createNewTags: true,
  language: 'auto',
  ocrEnabled: false,
  correspondentBlacklist: [],
  llmProviderId: 9,
  llmModel: 'claude-haiku-4-5',
  ocrProviderId: null,
  ocrModel: null,
};

const DEFAULT_DOC: PaperlessDocument = {
  id: 5,
  title: 'scan_0001',
  content: 'Invoice from ACME total 42 dated 2024-03-02',
  tags: [REVIEW_TAG],
  correspondent: null,
  created: '2024-01-01T00:00:00Z',
};

const EXTRACTION = {
  title: 'ACME Invoice',
  tags: ['invoice'],
  correspondent: 'ACME',
  date: '2024-03-02',
};

interface Overrides {
  settings?: Partial<Settings>;
  doc?: Partial<PaperlessDocument>;
  hasCompleted?: boolean;
  resolvedTags?: { id: number | null; name: string; isNew: boolean }[];
  resolvedCorrespondent?: { id: number | null; name: string; isNew: boolean } | null;
  credential?: unknown;
}

function makePipeline(o: Overrides = {}) {
  const doc = { ...DEFAULT_DOC, ...o.doc };
  const client = {
    getDocument: vi.fn().mockResolvedValue(doc),
    patchDocument: vi.fn().mockResolvedValue(doc),
  };
  const connection = { getClient: () => client } as unknown as ConnectionService;

  const credential =
    o.credential === undefined
      ? { name: 'c', kind: 'anthropic', apiKey: 'k', baseUrl: null }
      : o.credential;
  const providers = { getCredential: vi.fn().mockReturnValue(credential) } as unknown as ProviderService;

  const settings = {
    get: () => ({ ...DEFAULT_SETTINGS, ...o.settings }),
  } as unknown as SettingsService;

  const llm = {
    generateStructured: vi.fn().mockResolvedValue({
      object: EXTRACTION,
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    }),
  } as unknown as LlmService & { generateStructured: ReturnType<typeof vi.fn> };

  const taxonomy = {
    resolveTriggerTags: vi.fn().mockResolvedValue({ reviewTagId: REVIEW_TAG, autoTagId: AUTO_TAG }),
    getSnapshot: vi.fn().mockResolvedValue({
      tags: [
        { id: 9, name: 'Existing' },
        { id: REVIEW_TAG, name: 'ai-process' },
        { id: AUTO_TAG, name: 'ai-process-auto' },
      ],
      correspondents: [{ id: 3, name: 'ACME' }],
    }),
    resolveTags: vi.fn().mockResolvedValue(o.resolvedTags ?? [{ id: 7, name: 'invoice', isNew: false }]),
    resolveCorrespondent: vi
      .fn()
      .mockResolvedValue(
        o.resolvedCorrespondent === undefined
          ? { id: 3, name: 'ACME', isNew: false }
          : o.resolvedCorrespondent,
      ),
    tagNames: vi.fn().mockResolvedValue(['Existing']),
    correspondentName: vi.fn().mockResolvedValue(null),
  } as unknown as TaxonomyService;

  const review = { create: vi.fn() } as unknown as ReviewService & { create: ReturnType<typeof vi.fn> };
  const queue = {
    hasCompletedWithHash: vi.fn().mockReturnValue(o.hasCompleted ?? false),
  } as unknown as QueueService;
  const audit = { record: vi.fn() } as unknown as AuditService & { record: ReturnType<typeof vi.fn> };

  const pipeline = new PipelineService(connection, providers, settings, llm, taxonomy, review, queue, audit);
  return { pipeline, client, llm, review, audit };
}

describe('PipelineService.process', () => {
  it('auto-applies when the document carries the auto tag', async () => {
    const { pipeline, client, review, audit } = makePipeline({
      doc: { tags: [9, AUTO_TAG] },
    });

    const result = await pipeline.process(JOB);

    expect(result).toMatchObject({ decision: 'auto-applied', cost: 15 });
    expect(client.patchDocument).toHaveBeenCalledOnce();
    const [, patch] = client.patchDocument.mock.calls[0];
    expect(patch).toEqual({
      title: 'ACME Invoice',
      tags: [9, 7], // keeps existing 9, drops trigger 101, adds suggested 7
      correspondent: 3,
      created: '2024-03-02', // date-only — no UTC-midnight day shift
    });
    expect(review.create).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ decision: 'auto-applied' }));
  });

  it('queues a review item (no PATCH) when only the review tag is present', async () => {
    const { pipeline, client, review, audit } = makePipeline({ doc: { tags: [REVIEW_TAG] } });

    const result = await pipeline.process(JOB);

    expect(result.decision).toBe('review-queued');
    expect(client.patchDocument).not.toHaveBeenCalled();
    expect(review.create).toHaveBeenCalledOnce();
    const [jobId, docId, suggestions] = review.create.mock.calls[0];
    expect({ jobId, docId }).toEqual({ jobId: 1, docId: 5 });
    expect(suggestions).toMatchObject({
      title: 'ACME Invoice',
      date: '2024-03-02',
      current: { title: 'scan_0001', tagNames: ['Existing'], date: '2024-01-01' },
    });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ decision: 'review-queued' }));
  });

  it('auto-applies a review-tagged document when global autoApply is on', async () => {
    const { pipeline, client } = makePipeline({
      doc: { tags: [REVIEW_TAG] },
      settings: { autoApply: true },
    });
    const result = await pipeline.process(JOB);
    expect(result.decision).toBe('auto-applied');
    expect(client.patchDocument).toHaveBeenCalledOnce();
  });

  it('skips an identical auto rerun: drops the trigger tag, no LLM call', async () => {
    const { pipeline, client, llm, review, audit } = makePipeline({
      doc: { tags: [9, AUTO_TAG] },
      hasCompleted: true,
    });

    const result = await pipeline.process(JOB);

    expect(result).toMatchObject({ decision: 'skipped', cost: null });
    expect(llm.generateStructured).not.toHaveBeenCalled();
    expect(client.patchDocument).toHaveBeenCalledWith(5, { tags: [9] });
    expect(review.create).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ decision: 'skipped' }));
  });

  it('skips an identical review rerun: clears the trigger tag, no LLM or review item', async () => {
    const { pipeline, client, llm, review } = makePipeline({
      doc: { tags: [REVIEW_TAG] },
      hasCompleted: true,
    });
    const result = await pipeline.process(JOB);
    expect(result.decision).toBe('skipped');
    // trigger tag dropped so the document isn't re-polled forever
    expect(client.patchDocument).toHaveBeenCalledWith(5, { tags: [] });
    expect(llm.generateStructured).not.toHaveBeenCalled();
    expect(review.create).not.toHaveBeenCalled();
  });

  it('defers (does not fail) when the document has no text yet', async () => {
    const { pipeline } = makePipeline({ doc: { content: '   ' } });
    await expect(pipeline.process(JOB)).rejects.toBeInstanceOf(DeferJobError);
  });

  it('fails when no model is selected', async () => {
    const { pipeline } = makePipeline({ settings: { llmProviderId: null, llmModel: null } });
    await expect(pipeline.process(JOB)).rejects.toThrow(/No LLM model/i);
  });

  it('fails when the selected provider has been deleted', async () => {
    const { pipeline } = makePipeline({ credential: null });
    await expect(pipeline.process(JOB)).rejects.toThrow(/no longer exists/i);
  });
});
