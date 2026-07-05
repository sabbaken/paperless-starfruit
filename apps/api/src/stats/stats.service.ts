import { Inject, Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
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
    const jobs = this.db.select().from(job).all();
    const queue = { queued: 0, running: 0, done: 0, failed: 0 };
    let tokenSpend = 0;
    // Throughput = jobs completed in the last 24h, an at-a-glance "is it working?"
    // gauge that doesn't grow unbounded the way the lifetime `done` count does.
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    let throughput = 0;
    for (const j of jobs) {
      if (j.status in queue) queue[j.status as keyof typeof queue] += 1;
      tokenSpend += j.cost ?? 0;
      if (j.status === JOB_STATUS.DONE && j.updatedAt.getTime() >= dayAgo) throughput += 1;
    }

    // Error rate over *finished* jobs only (done + failed); queued/running aren't
    // outcomes yet. 0 when nothing has finished, so the card never shows NaN.
    const finished = queue.done + queue.failed;
    const errorRate = finished > 0 ? queue.failed / finished : 0;

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
