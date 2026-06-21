import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { ACTIVE_JOB_STATUSES, JOB_STATUS } from '@paperless-starfruit/shared';
import { DB } from '../db/db.module';
import type { Db } from '../db/client';
import { job, type Job } from '../db/schema';

/**
 * Minimal SQLite-table queue. `better-sqlite3` is synchronous and single-process,
 * so every operation here runs in one uninterruptible tick — claims are race-free
 * without any broker, reaper, or visibility timeout.
 */
@Injectable()
export class QueueService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /**
   * Enqueue a document unless it already has an active (queued/running) job.
   * Returns true if a new job row was inserted, false if one was already active.
   */
  enqueue(documentId: number): boolean {
    const existing = this.db
      .select({ id: job.id })
      .from(job)
      .where(
        and(
          eq(job.documentId, documentId),
          inArray(job.status, ACTIVE_JOB_STATUSES),
        ),
      )
      .limit(1)
      .all();

    if (existing.length > 0) return false;

    this.db.insert(job).values({ documentId }).run();
    return true;
  }

  /** Atomically claim the oldest queued job and mark it running. */
  claimNext(): Job | null {
    const claimed = this.db
      .update(job)
      .set({
        status: JOB_STATUS.RUNNING,
        attempts: sql`${job.attempts} + 1`,
        updatedAt: sql`(unixepoch())`,
      })
      .where(
        eq(
          job.id,
          sql`(select id from job where status = ${JOB_STATUS.QUEUED} order by id asc limit 1)`,
        ),
      )
      .returning()
      .all();

    return claimed[0] ?? null;
  }

  /** Mark a job done, recording the post-OCR content hash and optional cost. */
  complete(id: number, contentHash: string, cost?: number): void {
    this.db
      .update(job)
      .set({
        status: JOB_STATUS.DONE,
        contentHash,
        cost: cost ?? null,
        error: null,
        updatedAt: sql`(unixepoch())`,
      })
      .where(eq(job.id, id))
      .run();
  }

  /** Re-queue on failure while attempts remain; otherwise mark failed. */
  fail(id: number, error: string): void {
    this.db
      .update(job)
      .set({
        status: sql`case when ${job.attempts} < ${job.maxAttempts} then ${JOB_STATUS.QUEUED} else ${JOB_STATUS.FAILED} end`,
        error,
        updatedAt: sql`(unixepoch())`,
      })
      .where(eq(job.id, id))
      .run();
  }

  /**
   * Has this document already been processed with identical input + config?
   * Used by the pipeline (post-OCR) to skip a byte-for-byte-identical rerun.
   */
  hasCompletedWithHash(documentId: number, contentHash: string): boolean {
    const rows = this.db
      .select({ id: job.id })
      .from(job)
      .where(
        and(
          eq(job.documentId, documentId),
          eq(job.contentHash, contentHash),
          eq(job.status, JOB_STATUS.DONE),
        ),
      )
      .limit(1)
      .all();

    return rows.length > 0;
  }
}
