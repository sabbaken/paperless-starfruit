import { describe, expect, it, vi } from 'vitest';
import type { Settings } from '@paperless-starfruit/shared';
import type { Job } from '../db/schema';
import { DeferJobError } from './defer-job.error';
import { configFingerprint, contentHash } from './fingerprint';
import type { PaperlessDocument } from '../paperless/paperless.schemas';
import type { ConnectionService } from '../connection/connection.service';
import type { ProviderService } from '../providers/provider.service';
import type { SettingsService } from '../settings/settings.service';
import type { LlmService } from '../providers/llm.service';
import type { OcrService } from '../providers/ocr.service';
import type { TagCommentsService } from '../taxonomy/tag-comments.service';
import type { TaxonomyService } from '../taxonomy/taxonomy.service';
import type { ReviewService } from '../review/review.service';
import type { QueueService } from '../queue/queue.service';
import type { AuditService } from '../audit/audit.service';
import type { PromptsService } from '../prompts/prompts.service';
import { PipelineService } from './pipeline.service';

const TRIGGER_TAG = 100;
const JOB: Job = { id: 1, documentId: 5 } as Job;

const DEFAULT_SETTINGS: Settings = {
  pollIntervalSec: 60,
  autoApply: false,
  createNewTags: false,
  createNewCorrespondents: true,
  extractMaxPages: null,
  language: 'auto',
  ocrEnabled: false,
  ocrMaxPages: null,
  correspondentBlacklist: [],
  llmProviderId: 9,
  llmModel: 'claude-haiku-4-5',
  ocrProviderId: null,
  ocrModel: null,
  checkForUpdates: true,
};

const DEFAULT_DOC: PaperlessDocument = {
  id: 5,
  title: 'scan_0001',
  content: 'Invoice from ACME total 42 dated 2024-03-02',
  tags: [TRIGGER_TAG],
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
  /** OCR output text (when `settings.ocrEnabled`); '' / whitespace simulates a blank scan. */
  ocrText?: string;
}

function makePipeline(o: Overrides = {}) {
  const doc = { ...DEFAULT_DOC, ...o.doc };
  const client = {
    getDocument: vi.fn().mockResolvedValue(doc),
    patchDocument: vi.fn().mockResolvedValue(doc),
    downloadOriginal: vi
      .fn()
      .mockResolvedValue({ data: Buffer.from('%PDF-1.4 bytes'), contentType: 'application/pdf' }),
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

  const ocr = {
    ocr: vi.fn().mockResolvedValue({
      text: o.ocrText ?? 'OCR text of the document',
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    }),
  } as unknown as OcrService & { ocr: ReturnType<typeof vi.fn> };

  const taxonomy = {
    resolveTriggerTag: vi.fn().mockResolvedValue(TRIGGER_TAG),
    getSnapshot: vi.fn().mockResolvedValue({
      tags: [
        { id: 9, name: 'Existing' },
        { id: TRIGGER_TAG, name: 'psf-process' },
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

  // The real PromptsService renders a template; for the pipeline we only care that
  // the document vars (notably `content`) reach the prompt, so stringify them.
  const prompts = {
    render: vi.fn((_key: string, vars: Record<string, string>) => JSON.stringify(vars)),
  } as unknown as PromptsService & { render: ReturnType<typeof vi.fn> };

  const tagComments = { map: vi.fn().mockReturnValue(new Map()) } as unknown as TagCommentsService;

  const pipeline = new PipelineService(
    connection,
    providers,
    settings,
    llm,
    ocr,
    taxonomy,
    tagComments,
    review,
    queue,
    audit,
    prompts,
  );
  return { pipeline, client, llm, ocr, review, audit, prompts, taxonomy };
}

/** Settings that turn OCR on, pointing it at a (mocked) credential + model. */
const OCR_ON: Partial<Settings> = {
  ocrEnabled: true,
  ocrProviderId: 9,
  ocrModel: 'claude-haiku-4-5',
};

describe('PipelineService.process', () => {
  it('auto-applies when auto-apply is on', async () => {
    const { pipeline, client, review, audit } = makePipeline({
      doc: { tags: [9, TRIGGER_TAG] },
      settings: { autoApply: true },
    });

    const result = await pipeline.process(JOB);

    expect(result).toMatchObject({ decision: 'auto-applied', cost: 15 });
    expect(client.patchDocument).toHaveBeenCalledOnce();
    const [, patch] = client.patchDocument.mock.calls[0];
    expect(patch).toEqual({
      title: 'ACME Invoice',
      tags: [9, 7], // keeps existing 9, drops trigger 100, adds suggested 7
      correspondent: 3,
      created: '2024-03-02', // date-only — no UTC-midnight day shift
    });
    expect(review.create).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ decision: 'auto-applied' }));
  });

  it('gates tag and correspondent creation independently in auto mode', async () => {
    const { pipeline, taxonomy } = makePipeline({
      doc: { tags: [9, TRIGGER_TAG] },
      settings: { autoApply: true, createNewTags: true, createNewCorrespondents: false },
    });

    await pipeline.process(JOB);

    expect(vi.mocked(taxonomy.resolveTags)).toHaveBeenCalledWith(
      expect.anything(),
      ['invoice'],
      expect.objectContaining({ create: true }),
    );
    expect(vi.mocked(taxonomy.resolveCorrespondent)).toHaveBeenCalledWith(
      expect.anything(),
      'ACME',
      expect.objectContaining({ create: false }),
    );
  });

  it('never creates new entities in review mode, regardless of the settings', async () => {
    const { pipeline, taxonomy } = makePipeline({
      doc: { tags: [TRIGGER_TAG] },
      settings: { createNewTags: true, createNewCorrespondents: true },
    });

    await pipeline.process(JOB);

    expect(vi.mocked(taxonomy.resolveTags)).toHaveBeenCalledWith(
      expect.anything(),
      ['invoice'],
      expect.objectContaining({ create: false }),
    );
    expect(vi.mocked(taxonomy.resolveCorrespondent)).toHaveBeenCalledWith(
      expect.anything(),
      'ACME',
      expect.objectContaining({ create: false }),
    );
  });

  it('reflects the create-new settings in the rendered extraction prompt vars', async () => {
    const { pipeline, prompts } = makePipeline({
      doc: { tags: [TRIGGER_TAG] },
      settings: { createNewTags: true, createNewCorrespondents: false },
    });

    await pipeline.process(JOB);

    const extractionCall = vi
      .mocked(prompts.render)
      .mock.calls.find(([key]) => key === 'extraction');
    const vars = extractionCall?.[1] as Record<string, string>;
    expect(vars.tag_policy).toContain('may introduce a new tag');
    expect(vars.correspondent_policy).toContain('Do not invent a new correspondent');
  });

  it('queues a review item (no PATCH) when auto-apply is off', async () => {
    const { pipeline, client, review, audit } = makePipeline({ doc: { tags: [TRIGGER_TAG] } });

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

  it('skips an identical rerun in auto mode: drops the trigger tag, no LLM call', async () => {
    const { pipeline, client, llm, review, audit } = makePipeline({
      doc: { tags: [9, TRIGGER_TAG] },
      settings: { autoApply: true },
      hasCompleted: true,
    });

    const result = await pipeline.process(JOB);

    expect(result).toMatchObject({ decision: 'skipped', cost: null });
    expect(llm.generateStructured).not.toHaveBeenCalled();
    expect(client.patchDocument).toHaveBeenCalledWith(5, { tags: [9] });
    expect(review.create).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ decision: 'skipped' }));
  });

  it('skips an identical rerun in review mode: clears the trigger tag, no LLM or review item', async () => {
    const { pipeline, client, llm, review } = makePipeline({
      doc: { tags: [TRIGGER_TAG] },
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

describe('PipelineService.process — page limits', () => {
  it('skips extraction AND OCR when page_count exceeds the extraction limit', async () => {
    const { pipeline, client, llm, ocr, audit } = makePipeline({
      doc: { tags: [9, TRIGGER_TAG], page_count: 100 },
      settings: { ...OCR_ON, autoApply: true, extractMaxPages: 50, ocrMaxPages: 200 },
    });

    const result = await pipeline.process(JOB);

    expect(result).toMatchObject({ decision: 'skipped', cost: null });
    expect(llm.generateStructured).not.toHaveBeenCalled();
    // Neither OCR nor download happens — the whole document is left untouched.
    expect(ocr.ocr).not.toHaveBeenCalled();
    expect(client.downloadOriginal).not.toHaveBeenCalled();
    // The trigger tag is dropped so it isn't re-polled; nothing else is changed.
    expect(client.patchDocument).toHaveBeenCalledWith(5, { tags: [9] });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ decision: 'skipped' }));
    // The skip's hash must NOT match what a real OCR-off completion would produce —
    // otherwise raising the limit and re-tagging would be wrongly skipped as "done".
    const realOcrOffHash = contentHash(
      'Invoice from ACME total 42 dated 2024-03-02',
      configFingerprint({ llm: { kind: 'anthropic', model: 'claude-haiku-4-5' }, ocr: null }),
    );
    expect(result.contentHash).not.toBe(realOcrOffHash);
  });

  it('skips OCR but still extracts when page_count is over the OCR limit only', async () => {
    const { pipeline, client, llm, ocr } = makePipeline({
      doc: { tags: [9, TRIGGER_TAG], content: 'paperless tesseract text', page_count: 20 },
      settings: { ...OCR_ON, autoApply: true, ocrMaxPages: 10 },
    });

    const result = await pipeline.process(JOB);

    expect(result.decision).toBe('auto-applied');
    // OCR is skipped — paperless's own text is reused for extraction.
    expect(ocr.ocr).not.toHaveBeenCalled();
    expect(client.downloadOriginal).not.toHaveBeenCalled();
    const [args] = llm.generateStructured.mock.calls[0];
    expect(args.prompt).toContain('paperless tesseract text');
    // No OCR ran, so the metadata PATCH carries no content write-back.
    const [, patch] = client.patchDocument.mock.calls[0];
    expect(patch).not.toHaveProperty('content');
  });

  it('still OCRs when page_count is within (equal to) the OCR limit', async () => {
    const { pipeline, ocr, client } = makePipeline({
      doc: { tags: [TRIGGER_TAG], content: 'stale', page_count: 10 },
      settings: { ...OCR_ON, ocrMaxPages: 10 },
      ocrText: 'freshly recognised text',
    });

    await pipeline.process(JOB);

    // 10 pages, limit 10 — "larger than" is strict, so OCR still runs.
    expect(ocr.ocr).toHaveBeenCalledOnce();
    expect(client.downloadOriginal).toHaveBeenCalledWith(5);
  });

  it('applies no gate when page_count is unknown (null)', async () => {
    const { pipeline, ocr } = makePipeline({
      // no page_count on the document
      doc: { tags: [TRIGGER_TAG], content: 'stale' },
      settings: { ...OCR_ON, ocrMaxPages: 1, extractMaxPages: 1 },
      ocrText: 'recognised text',
    });

    const result = await pipeline.process(JOB);

    // Can't prove the file is oversized, so nothing is skipped.
    expect(ocr.ocr).toHaveBeenCalledOnce();
    expect(result.decision).toBe('review-queued');
  });
});

describe('PipelineService.process — OCR (M5)', () => {
  it('OCRs the original and folds the text into the auto PATCH (one re-index)', async () => {
    const { pipeline, client, ocr } = makePipeline({
      doc: { tags: [9, TRIGGER_TAG], content: 'stale tesseract text' },
      settings: { ...OCR_ON, autoApply: true },
      ocrText: 'Fresh OCR — Invoice from ACME total 42 dated 2024-03-02',
    });

    const result = await pipeline.process(JOB);

    expect(ocr.ocr).toHaveBeenCalledOnce();
    expect(client.downloadOriginal).toHaveBeenCalledWith(5);
    expect(result.decision).toBe('auto-applied');
    // Single PATCH carries the OCR write-back alongside the metadata.
    expect(client.patchDocument).toHaveBeenCalledOnce();
    const [, patch] = client.patchDocument.mock.calls[0];
    expect(patch.content).toBe('Fresh OCR — Invoice from ACME total 42 dated 2024-03-02');
    // cost = extraction (15) + vision-LLM OCR (150)
    expect(result.cost).toBe(165);
  });

  it('writes OCR text back immediately in review mode, before approval', async () => {
    const { pipeline, client, review } = makePipeline({
      doc: { tags: [TRIGGER_TAG], content: 'stale' },
      settings: OCR_ON,
      ocrText: 'newly recognised text',
    });

    const result = await pipeline.process(JOB);

    expect(result.decision).toBe('review-queued');
    // Content is not a reviewable suggestion — write it back now, on its own PATCH.
    expect(client.patchDocument).toHaveBeenCalledWith(5, { content: 'newly recognised text' });
    expect(review.create).toHaveBeenCalledOnce();
  });

  it('does not PATCH content when OCR output matches the existing text', async () => {
    const { pipeline, client } = makePipeline({
      doc: { tags: [TRIGGER_TAG], content: 'identical text' },
      settings: OCR_ON,
      ocrText: 'identical text',
    });

    await pipeline.process(JOB);
    // Review mode + unchanged content ⇒ no PATCH at all (avoids a needless re-index).
    expect(client.patchDocument).not.toHaveBeenCalled();
  });

  it('feeds the OCR text (not the stale paperless text) into extraction', async () => {
    const { pipeline, llm } = makePipeline({
      doc: { tags: [TRIGGER_TAG], content: 'stale' },
      settings: OCR_ON,
      ocrText: 'the real recognised content',
    });

    await pipeline.process(JOB);

    const [args] = llm.generateStructured.mock.calls[0];
    expect(args.prompt).toContain('the real recognised content');
    expect(args.prompt).not.toContain('stale');
  });

  it('fails (not defers) when OCR returns no text — a blank/unreadable original', async () => {
    const { pipeline } = makePipeline({
      doc: { tags: [TRIGGER_TAG] },
      settings: OCR_ON,
      ocrText: '   ',
    });
    await expect(pipeline.process(JOB)).rejects.toThrow(/blank or unreadable/i);
  });

  it('skips OCR (uses paperless text) when OCR is on but no OCR model is selected', async () => {
    const { pipeline, ocr, client, llm } = makePipeline({
      doc: { tags: [TRIGGER_TAG], content: 'paperless tesseract text' },
      settings: { ocrEnabled: true, ocrProviderId: null, ocrModel: null },
    });

    const result = await pipeline.process(JOB);

    // No model ⇒ don't fail; fall back to paperless's text and still extract.
    expect(ocr.ocr).not.toHaveBeenCalled();
    expect(client.downloadOriginal).not.toHaveBeenCalled();
    expect(result.decision).toBe('review-queued');
    const [args] = llm.generateStructured.mock.calls[0];
    expect(args.prompt).toContain('paperless tesseract text');
  });

  it('defers with a model hint when OCR is on, no model, and no text yet', async () => {
    const { pipeline } = makePipeline({
      doc: { tags: [TRIGGER_TAG], content: '   ' },
      settings: { ocrEnabled: true, ocrProviderId: null, ocrModel: null },
    });
    await expect(pipeline.process(JOB)).rejects.toThrow(/select an OCR model/i);
  });

  it('reuses the OCR result across a retry, then re-OCRs after the job succeeds', async () => {
    const { pipeline, client, ocr, llm } = makePipeline({
      doc: { tags: [TRIGGER_TAG], content: 'stale' },
      settings: OCR_ON,
      ocrText: 'recognised text',
    });

    // First attempt: OCR succeeds, then a downstream step (extraction) fails.
    llm.generateStructured.mockRejectedValueOnce(new Error('LLM 500'));
    await expect(pipeline.process(JOB)).rejects.toThrow(/LLM 500/);
    expect(ocr.ocr).toHaveBeenCalledTimes(1);
    expect(client.downloadOriginal).toHaveBeenCalledTimes(1);

    // Retry (same job): the OCR result is reused from cache — no re-download, no re-bill.
    await pipeline.process(JOB);
    expect(ocr.ocr).toHaveBeenCalledTimes(1);
    expect(client.downloadOriginal).toHaveBeenCalledTimes(1);

    // After the job settles the cache is evicted, so an explicit reprocess OCRs afresh.
    await pipeline.process(JOB);
    expect(ocr.ocr).toHaveBeenCalledTimes(2);
  });

  it('reports the OCR tokens spent on a skipped identical rerun', async () => {
    const { pipeline, llm } = makePipeline({
      doc: { tags: [9, TRIGGER_TAG] },
      settings: OCR_ON,
      hasCompleted: true,
    });

    const result = await pipeline.process(JOB);

    expect(result.decision).toBe('skipped');
    // OCR ran (to compute the hash) but extraction was skipped.
    expect(result.cost).toBe(150);
    expect(llm.generateStructured).not.toHaveBeenCalled();
  });
});
