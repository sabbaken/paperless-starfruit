import { Inject, Injectable } from '@nestjs/common';
import { desc, eq, gte, or, sql } from 'drizzle-orm';
import {
  JOB_STATUS,
  REVIEW_STATUS,
  type JobSummary,
  type Stats,
  type StatsPeriod,
} from '@paperless-starfruit/shared';
import { DB } from '../db/db.module';
import type { Db } from '../db/client';
import { job, reviewItem, type Job } from '../db/schema';

const RECENT_LIMIT = 12;

/** Read-only dashboard aggregates over the job + review tables (single-user scale). */
@Injectable()
export class StatsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  get(period: StatsPeriod = '30'): Stats {
    const since = period === 'all' ? undefined : new Date(Date.now() - Number(period) * 86_400_000);
    const inPeriod = since ? gte(job.updatedAt, since) : undefined;
    // Active work stays visible even when it was queued before the selected period.
    const visible = inPeriod
      ? or(inPeriod, eq(job.status, JOB_STATUS.QUEUED), eq(job.status, JOB_STATUS.RUNNING))
      : undefined;
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
      .where(visible)
      .groupBy(job.status)
      .all();
    for (const row of byStatus) {
      if (row.status in queue) queue[row.status as keyof typeof queue] = row.count;
      if (row.status === JOB_STATUS.DONE || row.status === JOB_STATUS.FAILED) {
        tokenSpend += row.spend;
      }
    }

    const throughput = queue.done;

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
      .select({
        job,
        // Read only the title, not the stored prompts/outputs. Older known titles
        // also give context to retries and OCR-only jobs without extraction results.
        documentTitle: sql<string | null>`(
          select trim(json_extract(audit_log.result, '$.title'))
          from audit_log
          where audit_log.document_id = job.document_id
            and json_type(audit_log.result, '$.title') = 'text'
            and trim(json_extract(audit_log.result, '$.title')) != ''
          order by audit_log.created_at desc, audit_log.id desc
          limit 1
        )`,
      })
      .from(job)
      .where(visible)
      .orderBy(desc(job.updatedAt), desc(job.id))
      .limit(RECENT_LIMIT)
      .all()
      .map((row) => ({ ...toSummary(row.job), documentTitle: row.documentTitle }));

    return { queue, pendingReview, tokenSpend, throughput, errorRate, recentJobs };
  }
}

function toSummary(j: Job): Omit<JobSummary, 'documentTitle'> {
  return {
    id: j.id,
    documentId: j.documentId,
    status: j.status as JobSummary['status'],
    cost: j.cost ?? null,
    error: j.error ?? null,
    updatedAt: Math.floor(j.updatedAt.getTime() / 1000),
  };
}
