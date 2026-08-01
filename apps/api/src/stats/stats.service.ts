import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import {
  JOB_STATUS,
  REVIEW_STATUS,
  type JobSummary,
  type Stats,
} from '@paperless-starfruit/shared';
import { DB } from '../db/db.module';
import type { Db } from '../db/client';
import { job, reviewItem, type Job } from '../db/schema';

const RECENT_LIMIT = 12;

/** Read-only dashboard aggregates over the job + review tables (single-user scale). */
@Injectable()
export class StatsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  get(): Stats {
    // Counted in SQL, not by materialising the table: the dashboard polls this
    // every few seconds from every page, and better-sqlite3 is synchronous, so
    // reading every job row would block the event loop for as long as it takes.
    const queue = { queued: 0, running: 0, done: 0, failed: 0 };
    let tokenSpend = 0;
    const byStatus = this.db
      .select({
        status: job.status,
        count: sql<number>`count(*)`.mapWith(Number),
        spend: sql<number>`coalesce(sum(${job.cost}), 0)`.mapWith(Number),
      })
      .from(job)
      .groupBy(job.status)
      .all();
    for (const row of byStatus) {
      if (row.status in queue) queue[row.status as keyof typeof queue] = row.count;
      tokenSpend += row.spend;
    }

    // Throughput = jobs completed in the last 24h, an at-a-glance "is it working?"
    // gauge that doesn't grow unbounded the way the lifetime `done` count does.
    // Pass a Date: the column is drizzle's `timestamp` mode, so it binds as unix
    // seconds — a raw millisecond number would silently match nothing.
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const throughput =
      this.db
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(job)
        .where(and(eq(job.status, JOB_STATUS.DONE), gte(job.updatedAt, dayAgo)))
        .all()[0]?.count ?? 0;

    // Error rate over *finished* jobs only (done + failed); queued/running aren't
    // outcomes yet. 0 when nothing has finished, so the card never shows NaN.
    const finished = queue.done + queue.failed;
    const errorRate = finished > 0 ? queue.failed / finished : 0;

    const pendingReview =
      this.db
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(reviewItem)
        .where(eq(reviewItem.status, REVIEW_STATUS.PENDING))
        .all()[0]?.count ?? 0;

    const recentJobs = this.db
      .select()
      .from(job)
      .orderBy(desc(job.updatedAt), desc(job.id))
      .limit(RECENT_LIMIT)
      .all()
      .map(toSummary);

    return { queue, pendingReview, tokenSpend, throughput, errorRate, recentJobs };
  }
}

function toSummary(j: Job): JobSummary {
  return {
    id: j.id,
    documentId: j.documentId,
    status: j.status as JobSummary['status'],
    cost: j.cost ?? null,
    error: j.error ?? null,
    updatedAt: Math.floor(j.updatedAt.getTime() / 1000),
  };
}
