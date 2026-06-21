import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReviewSuggestions } from '@paperless-starfruit/shared';
import { createTestDb } from '../../test/db';
import { job } from '../db/schema';
import type { ConnectionService } from '../connection/connection.service';
import type { SettingsService } from '../settings/settings.service';
import type { TaxonomyService } from '../taxonomy/taxonomy.service';
import type { AuditService } from '../audit/audit.service';
import { ReviewService } from './review.service';

const REVIEW_TAG = 100;
const AUTO_TAG = 101;

const SUGGESTIONS: ReviewSuggestions = {
  title: 'ACME Invoice',
  tags: [
    { id: 7, name: 'invoice', isNew: false },
    { id: null, name: 'acme', isNew: true },
  ],
  correspondent: { id: 3, name: 'ACME', isNew: false },
  date: '2024-03-02',
  current: { title: 'scan_0001', tagNames: ['Old'], correspondentName: null, date: '2024-01-01' },
};

function makeReview(blacklist: string[] = []) {
  const db = createTestDb();
  const doc = {
    id: 5,
    title: 'scan_0001',
    content: 'document preview text',
    tags: [9, REVIEW_TAG],
    correspondent: null,
    created: '2024-01-01T00:00:00Z',
  };
  const client = {
    getDocument: vi.fn().mockResolvedValue(doc),
    patchDocument: vi.fn().mockResolvedValue(doc),
  };
  const connection = { getClient: () => client } as unknown as ConnectionService;
  const settings = { get: () => ({ correspondentBlacklist: blacklist }) } as unknown as SettingsService;
  const taxonomy = {
    resolveTriggerTags: vi.fn().mockResolvedValue({ reviewTagId: REVIEW_TAG, autoTagId: AUTO_TAG }),
    // Input-aware: map each requested name to a stable id.
    resolveTags: vi.fn((_client: unknown, names: string[]) =>
      Promise.resolve(
        names.map((name) => ({
          id: name === 'invoice' ? 7 : name === 'acme' ? 55 : 999,
          name,
          isNew: name === 'acme',
        })),
      ),
    ),
    resolveCorrespondent: vi.fn().mockResolvedValue({ id: 3, name: 'ACME', isNew: false }),
  } as unknown as TaxonomyService;
  const audit = { record: vi.fn() } as unknown as AuditService & { record: ReturnType<typeof vi.fn> };

  const service = new ReviewService(db, connection, settings, taxonomy, audit);
  // review_item.jobId is an FK → a real job row must exist first.
  const [jobRow] = db.insert(job).values({ documentId: 5 }).returning().all();
  service.create(jobRow.id, 5, SUGGESTIONS);
  const id = service.list()[0].id;
  return { service, client, taxonomy, audit, id };
}

describe('ReviewService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists pending items with parsed suggestions', () => {
    const { service, id } = makeReview();
    const list = service.list();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id, documentId: 5, status: 'pending' });
    expect(list[0].suggestions.title).toBe('ACME Invoice');
  });

  it('returns a detail with a document preview', async () => {
    const { service, id } = makeReview();
    const detail = await service.get(id);
    expect(detail.documentContent).toBe('document preview text');
  });

  it('approves: merges tags, sets correspondent + date, drops the trigger tag', async () => {
    const { service, client, audit, id } = makeReview();

    await service.approve(id, {
      title: 'ACME Invoice',
      tagNames: ['invoice', 'acme'],
      correspondentName: 'ACME',
      date: '2024-03-02',
    });

    expect(client.patchDocument).toHaveBeenCalledOnce();
    const [docId, patch] = client.patchDocument.mock.calls[0];
    expect(docId).toBe(5);
    expect(patch).toEqual({
      title: 'ACME Invoice',
      tags: [9, 7, 55], // keeps 9, drops trigger 100, adds resolved 7 + 55
      correspondent: 3,
      created: '2024-03-02', // date-only — no UTC-midnight day shift
    });
    expect(service.list('pending')).toHaveLength(0);
    expect(service.list('approved')).toHaveLength(1);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ decision: 'approved' }));
  });

  it('leaves correspondent + date unchanged when omitted', async () => {
    const { service, client, id } = makeReview();
    await service.approve(id, { title: 'T', tagNames: [], correspondentName: null, date: null });
    const [, patch] = client.patchDocument.mock.calls[0];
    expect(patch).not.toHaveProperty('correspondent');
    expect(patch).not.toHaveProperty('created');
    expect(patch.tags).toEqual([9]); // trigger removed, nothing added
  });

  it('refuses to approve an item that is not pending', async () => {
    const { service, id } = makeReview();
    await service.approve(id, { title: 'T', tagNames: [], correspondentName: null, date: null });
    await expect(
      service.approve(id, { title: 'T', tagNames: [], correspondentName: null, date: null }),
    ).rejects.toThrow(/already approved/i);
  });

  it('rejects: removes the trigger tag and marks rejected', async () => {
    const { service, client, audit, id } = makeReview();
    await service.reject(id);
    expect(client.patchDocument).toHaveBeenCalledWith(5, { tags: [9] });
    expect(service.list('rejected')).toHaveLength(1);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ decision: 'rejected' }));
  });

  it('bulk-approves using stored suggestions', async () => {
    const { service, id } = makeReview();
    const results = await service.bulkApprove([id]);
    expect(results).toEqual([{ id, ok: true }]);
    expect(service.list('pending')).toHaveLength(0);
  });

  it('reports per-item failure in bulk approve without aborting the batch', async () => {
    const { service } = makeReview();
    const results = await service.bulkApprove([9999]); // no such item
    expect(results[0].ok).toBe(false);
    expect(results[0].error).toMatch(/not found/i);
  });
});
