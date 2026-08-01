import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { JOB_STATUS } from '@paperless-starfruit/shared';
import { createTestDb } from '../../test/db';
import { job } from '../db/schema';
import { QueueService } from './queue.service';

describe('QueueService.enqueueMany', () => {
  it('enqueues the eligible documents in one transaction and counts them', () => {
    const db = createTestDb();
    const q = new QueueService(db);

    expect(q.enqueueMany([1, 2, 3, 4], (id) => id % 2 === 1)).toBe(2);

    expect(
      db
        .select()
        .from(job)
        .all()
        .map((r) => r.documentId),
    ).toEqual([1, 3]);
  });

  it('sees its own inserts mid-batch, so a document listed twice enqueues once', () => {
    const db = createTestDb();
    const q = new QueueService(db);

    // The per-document guards run inside the transaction and read through the
    // same connection; the active-job check must observe rows inserted earlier
    // in the same batch, not just what was committed before it started.
    expect(q.enqueueMany([5, 5], () => true)).toBe(1);
    expect(db.select().from(job).where(eq(job.documentId, 5)).all()).toHaveLength(1);
  });

  it('rolls the whole batch back when the eligibility check throws', () => {
    const db = createTestDb();
    const q = new QueueService(db);

    expect(() =>
      q.enqueueMany([1, 2], (id) => {
        if (id === 2) throw new Error('boom');
        return true;
      }),
    ).toThrow('boom');
    expect(db.select().from(job).all()).toHaveLength(0);
  });
});

describe('QueueService.retryDocument', () => {
  it('clears a terminally-failed row and enqueues a fresh job', () => {
    const db = createTestDb();
    const q = new QueueService(db);
    db.insert(job)
      .values({ documentId: 7, status: JOB_STATUS.FAILED, attempts: 3, error: 'boom' })
      .run();
    expect(q.hasTerminalFailure(7)).toBe(true);

    expect(q.retryDocument(7)).toBe(true);

    // the failure block is gone and a fresh queued job exists with a clean counter
    expect(q.hasTerminalFailure(7)).toBe(false);
    const rows = db.select().from(job).where(eq(job.documentId, 7)).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe(JOB_STATUS.QUEUED);
    expect(rows[0].attempts).toBe(0);
  });

  it('clears ALL failed rows for the document, not just one', () => {
    const db = createTestDb();
    const q = new QueueService(db);
    db.insert(job)
      .values([
        { documentId: 7, status: JOB_STATUS.FAILED, attempts: 3 },
        { documentId: 7, status: JOB_STATUS.FAILED, attempts: 3 },
      ])
      .run();

    q.retryDocument(7);
    expect(q.hasTerminalFailure(7)).toBe(false);
  });

  it('does not insert a duplicate while an active job exists', () => {
    const db = createTestDb();
    const q = new QueueService(db);
    db.insert(job).values({ documentId: 7, status: JOB_STATUS.RUNNING, attempts: 1 }).run();

    expect(q.retryDocument(7)).toBe(false);
    const rows = db.select().from(job).where(eq(job.documentId, 7)).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe(JOB_STATUS.RUNNING);
  });

  it('leaves other documents untouched', () => {
    const db = createTestDb();
    const q = new QueueService(db);
    db.insert(job)
      .values([
        { documentId: 7, status: JOB_STATUS.FAILED, attempts: 3 },
        { documentId: 8, status: JOB_STATUS.FAILED, attempts: 3 },
      ])
      .run();

    q.retryDocument(7);
    expect(q.hasTerminalFailure(8)).toBe(true);
  });
});
