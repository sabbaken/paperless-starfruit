import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { REVIEW_STATUS, type ReviewSuggestions } from '@paperless-ai/shared';
import { DB } from '../db/db.module';
import type { Db } from '../db/client';
import { reviewItem } from '../db/schema';

/**
 * The human-review queue produced when auto-apply is off. M3 covers creation
 * and the pending-check the poller uses to avoid re-enqueuing a document that's
 * already awaiting review; listing and approve/reject land in M4.
 */
@Injectable()
export class ReviewService {
  constructor(@Inject(DB) private readonly db: Db) {}

  create(jobId: number, documentId: number, suggestions: ReviewSuggestions): void {
    this.db
      .insert(reviewItem)
      .values({ jobId, documentId, suggestions, status: REVIEW_STATUS.PENDING })
      .run();
  }

  /** Is this document already awaiting review? Guards the poller against churn. */
  hasPending(documentId: number): boolean {
    return (
      this.db
        .select({ id: reviewItem.id })
        .from(reviewItem)
        .where(
          and(
            eq(reviewItem.documentId, documentId),
            eq(reviewItem.status, REVIEW_STATUS.PENDING),
          ),
        )
        .limit(1)
        .all().length > 0
    );
  }
}
