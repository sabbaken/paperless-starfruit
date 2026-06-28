import { describe, expect, it } from 'vitest';
import { JOB_STATUS } from '@paperless-starfruit/shared';
import { createTestDb } from '../../test/db';
import { job } from '../db/schema';
import { StatsService } from './stats.service';

describe('StatsService', () => {
  it('tallies queue depth, token spend, 24h throughput and error rate', () => {
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
    // only the DONE job updated within 24h counts
    expect(stats.throughput).toBe(1);
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
