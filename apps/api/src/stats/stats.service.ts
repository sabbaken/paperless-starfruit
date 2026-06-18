import { Inject, Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { REVIEW_STATUS, type JobSummary, type Stats } from '@paperless-ai/shared';
import { DB } from '../db/db.module';
import type { Db } from '../db/client';
import { job, reviewItem, type Job } from '../db/schema';

const RECENT_LIMIT = 12;

/** Read-only dashboard aggregates over the job + review tables (single-user scale). */
@Injectable()
export class StatsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  get(): Stats {
    const jobs = this.db.select().from(job).all();
    const queue = { queued: 0, running: 0, done: 0, failed: 0 };
    let tokenSpend = 0;
    for (const j of jobs) {
      if (j.status in queue) queue[j.status as keyof typeof queue] += 1;
      tokenSpend += j.cost ?? 0;
    }

    const pendingReview = this.db
      .select({ id: reviewItem.id })
      .from(reviewItem)
      .where(eq(reviewItem.status, REVIEW_STATUS.PENDING))
      .all().length;

    const recentJobs = this.db
      .select()
      .from(job)
      .orderBy(desc(job.updatedAt), desc(job.id))
      .limit(RECENT_LIMIT)
      .all()
      .map(toSummary);

    return { queue, pendingReview, tokenSpend, recentJobs };
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
