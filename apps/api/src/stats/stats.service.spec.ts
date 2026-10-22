import { afterEach, describe, expect, it, vi } from 'vitest';
import { JOB_STATUS, statsQuerySchema } from '@paperless-starfruit/shared';
import { createTestDb } from '../../test/db';
import { auditLog, job, reviewItem } from '../db/schema';
import { StatsService } from './stats.service';

describe('StatsService', () => {
  afterEach(() => vi.restoreAllMocks());
  it('tallies queue depth, token spend, period throughput and error rate', () => {
    const db = createTestDb();
    const now = Date.now();
    const recent = new Date(now - 60_000); // 1 minute ago
    const old = new Date(now - 3 * 24 * 60 * 60 * 1000); // 3 days ago

    db.insert(job)
      .values([
        { documentId: 1, status: JOB_STATUS.DONE, cost: 100, updatedAt: recent },
        { documentId: 2, status: JOB_STATUS.DONE, cost: 50, updatedAt: old },
        { documentId: 3, status: JOB_STATUS.FAILED, cost: null, updatedAt: recent },
        { documentId: 4, status: JOB_STATUS.QUEUED, cost: null, updatedAt: recent },
      ])
      .run();

    const stats = new StatsService(db).get();
    expect(stats.queue).toEqual({ queued: 1, running: 0, done: 2, failed: 1 });
    expect(stats.tokenSpend).toBe(150);
    // Both completed jobs fall within the default 30 days.
    expect(stats.throughput).toBe(2);
    // finished = done(2) + failed(1); failed 1 → 1/3
    expect(stats.errorRate).toBeCloseTo(1 / 3, 5);
    expect(stats.recentJobs).toHaveLength(4);
  });

  it('reports a 0 error rate and throughput when nothing has finished', () => {
    const db = createTestDb();
    db.insert(job).values({ documentId: 1, status: JOB_STATUS.QUEUED }).run();

    const stats = new StatsService(db).get();
    expect(stats.errorRate).toBe(0);
    expect(stats.throughput).toBe(0);
  });
});

describe('dashboard period', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each(['30', '90', '365'] as const)(
    'includes the %s-day boundary but excludes older outcomes',
    (period) => {
      const now = Date.UTC(2026, 9, 22, 12);
      vi.spyOn(Date, 'now').mockReturnValue(now);
      const db = createTestDb();
      const boundary = new Date(now - Number(period) * 86_400_000);
      const before = new Date(boundary.getTime() - 1000);
      const rows = db
        .insert(job)
        .values([
          { documentId: 1, status: JOB_STATUS.DONE, cost: 100, updatedAt: boundary },
          { documentId: 2, status: JOB_STATUS.FAILED, cost: 20, updatedAt: boundary },
          { documentId: 3, status: JOB_STATUS.DONE, cost: 900, updatedAt: before },
          { documentId: 4, status: JOB_STATUS.FAILED, cost: 30, updatedAt: before },
          { documentId: 5, status: JOB_STATUS.QUEUED, updatedAt: before },
          { documentId: 6, status: JOB_STATUS.RUNNING, updatedAt: before },
        ])
        .returning()
        .all();
      db.insert(reviewItem)
        .values({ jobId: rows[2].id, documentId: 3, suggestions: {}, createdAt: before })
        .run();

      const stats = new StatsService(db).get(period);
      expect(stats.queue).toEqual({ queued: 1, running: 1, done: 1, failed: 1 });
      expect(stats.pendingReview).toBe(1);
      expect(stats.tokenSpend).toBe(120);
      expect(stats.throughput).toBe(1);
      expect(stats.errorRate).toBe(0.5);
      expect(stats.recentJobs.map((row) => row.documentId)).toEqual([2, 1, 6, 5]);
      expect(
        stats.recentJobs.filter((row) => row.status === 'failed').map((row) => row.documentId),
      ).toEqual([2]);

      const all = new StatsService(db).get('all');
      expect(all.queue).toEqual({ queued: 1, running: 1, done: 2, failed: 2 });
      expect(all.tokenSpend).toBe(1050);
      expect(all.throughput).toBe(2);
      expect(all.recentJobs).toHaveLength(6);
    },
  );

  it('defaults to 30 days and validates the available periods', () => {
    expect(statsQuerySchema.parse({})).toEqual({ period: '30' });
    for (const period of ['30', '90', '365', 'all']) {
      expect(statsQuerySchema.parse({ period }).period).toBe(period);
    }
    for (const period of ['0', '-30', '31', 'nope', ['30', '90']]) {
      expect(statsQuerySchema.safeParse({ period }).success).toBe(false);
    }
  });

  it('uses the latest nonempty extracted title, including for later retries', () => {
    const db = createTestDb();
    const [first] = db
      .insert(job)
      .values({ documentId: 1, status: JOB_STATUS.DONE })
      .returning()
      .all();
    db.insert(job)
      .values([
        { documentId: 1, status: JOB_STATUS.FAILED },
        { documentId: 2, status: JOB_STATUS.DONE },
      ])
      .run();
    db.insert(auditLog)
      .values([
        { documentId: 1, jobId: first.id, result: { title: 'Old title' } },
        { documentId: 1, jobId: first.id, result: { title: '  Electricity bill  ' } },
        { documentId: 1, jobId: first.id, decision: 'approved' },
        { documentId: 1, result: { title: '   ' } },
        { documentId: 1, result: { title: 123 } },
        { documentId: 2, result: { tags: [] } },
      ])
      .run();

    const stats = new StatsService(db).get();
    expect(
      stats.recentJobs.filter((row) => row.documentId === 1).map((row) => row.documentTitle),
    ).toEqual(['Electricity bill', 'Electricity bill']);
    expect(stats.recentJobs.find((row) => row.documentId === 2)?.documentTitle).toBeNull();
  });
});
