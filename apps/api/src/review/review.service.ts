import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import {
  REVIEW_STATUS,
  reviewSuggestionsSchema,
  type ReviewApprove,
  type ReviewDetail,
  type ReviewItemView,
  type ReviewStatus,
  type ReviewSuggestions,
} from '@paperless-starfruit/shared';
import { DB } from '../db/db.module';
import type { Db } from '../db/client';
import { reviewItem, type ReviewItem } from '../db/schema';
import { ConnectionService } from '../connection/connection.service';
import { SettingsService } from '../settings/settings.service';
import { TaxonomyService } from '../taxonomy/taxonomy.service';
import { mergeTagIds } from '../taxonomy/tags';
import { AuditService } from '../audit/audit.service';
import type { PaperlessClient } from '../paperless/paperless.client';

/** Per-id outcome for a bulk action. */
export interface BulkResult {
  id: number;
  ok: boolean;
  error?: string;
}

const MAX_PREVIEW_CHARS = 8_000;

/**
 * The human-review queue: creation (M3), and listing + approve/edit/reject
 * (M4). Approving resolves the user-confirmed names to ids (creating any that
 * are missing), merges them with the document's existing tags and writes the
 * change back to paperless, dropping the trigger tags in the same PATCH.
 */
@Injectable()
export class ReviewService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly connection: ConnectionService,
    private readonly settings: SettingsService,
    private readonly taxonomy: TaxonomyService,
    private readonly audit: AuditService,
  ) {}

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

  list(status: ReviewStatus = REVIEW_STATUS.PENDING): ReviewItemView[] {
    return this.db
      .select()
      .from(reviewItem)
      .where(eq(reviewItem.status, status))
      .orderBy(desc(reviewItem.id))
      .all()
      .map(toView);
  }

  async get(id: number): Promise<ReviewDetail> {
    const row = this.require(id);
    const client = this.connection.getClient();
    let documentContent: string | null = null;
    if (client) {
      try {
        const doc = await client.getDocument(row.documentId);
        documentContent = (doc.content ?? '').slice(0, MAX_PREVIEW_CHARS) || null;
      } catch {
        // Preview is best-effort — the document may have been deleted in paperless.
        documentContent = null;
      }
    }
    return { ...toView(row), documentContent };
  }

  async approve(id: number, payload: ReviewApprove): Promise<void> {
    const row = this.require(id);
    this.assertPending(row);
    const client = this.requireClient();
    await this.applyApproval(client, row, payload);
    this.markStatus(id, REVIEW_STATUS.APPROVED);
    this.audit.record({
      jobId: row.jobId,
      documentId: row.documentId,
      decision: 'approved',
      result: payload,
    });
  }

  async reject(id: number): Promise<void> {
    const row = this.require(id);
    this.assertPending(row);
    const client = this.requireClient();
    const doc = await client.getDocument(row.documentId);
    const { reviewTagId, autoTagId } = await this.taxonomy.resolveTriggerTags(client);
    const tags = doc.tags.filter((t) => t !== reviewTagId && t !== autoTagId);
    if (tags.length !== doc.tags.length) await client.patchDocument(doc.id, { tags });
    this.markStatus(id, REVIEW_STATUS.REJECTED);
    this.audit.record({ jobId: row.jobId, documentId: row.documentId, decision: 'rejected' });
  }

  /** Approve several items using their suggested values as-is. */
  async bulkApprove(ids: number[]): Promise<BulkResult[]> {
    const client = this.requireClient();
    const results: BulkResult[] = [];
    for (const id of ids) {
      try {
        const row = this.require(id);
        this.assertPending(row);
        await this.applyApproval(client, row, suggestionToApproval(toSuggestions(row)));
        this.markStatus(id, REVIEW_STATUS.APPROVED);
        this.audit.record({ jobId: row.jobId, documentId: row.documentId, decision: 'approved' });
        results.push({ id, ok: true });
      } catch (err) {
        results.push({ id, ok: false, error: err instanceof Error ? err.message : 'failed' });
      }
    }
    return results;
  }

  private async applyApproval(
    client: PaperlessClient,
    row: ReviewItem,
    payload: ReviewApprove,
  ): Promise<void> {
    const doc = await client.getDocument(row.documentId);
    const { reviewTagId, autoTagId } = await this.taxonomy.resolveTriggerTags(client);
    const blacklist = this.settings.get().correspondentBlacklist;

    // The user explicitly confirmed these, so create-if-missing regardless of
    // the autonomous create-new-tags setting.
    const resolvedTags = await this.taxonomy.resolveTags(client, payload.tagNames, { create: true });
    const correspondent = payload.correspondentName
      ? await this.taxonomy.resolveCorrespondent(client, payload.correspondentName, {
          create: true,
          blacklist,
        })
      : null;

    const addIds = resolvedTags.map((t) => t.id).filter((x): x is number => x != null);
    const patch = {
      title: payload.title,
      tags: mergeTagIds(doc.tags, addIds, [reviewTagId, autoTagId]),
      ...(correspondent?.id != null ? { correspondent: correspondent.id } : {}),
      // Date-only — a UTC-midnight datetime shifts a day on UTC-behind servers.
      ...(payload.date ? { created: payload.date } : {}),
    };
    await client.patchDocument(doc.id, patch);
  }

  private require(id: number): ReviewItem {
    const row = this.db.select().from(reviewItem).where(eq(reviewItem.id, id)).all()[0];
    if (!row) throw new NotFoundException(`Review item ${id} not found`);
    return row;
  }

  private assertPending(row: ReviewItem): void {
    if (row.status !== REVIEW_STATUS.PENDING) {
      throw new BadRequestException(`Review item ${row.id} is already ${row.status}.`);
    }
  }

  private requireClient(): PaperlessClient {
    const client = this.connection.getClient();
    if (!client) throw new BadRequestException('No paperless connection is configured.');
    return client;
  }

  private markStatus(id: number, status: ReviewStatus): void {
    this.db.update(reviewItem).set({ status }).where(eq(reviewItem.id, id)).run();
  }
}

function toSuggestions(row: ReviewItem): ReviewSuggestions {
  return reviewSuggestionsSchema.parse(row.suggestions);
}

function toView(row: ReviewItem): ReviewItemView {
  return {
    id: row.id,
    documentId: row.documentId,
    status: row.status as ReviewStatus,
    createdAt: Math.floor(row.createdAt.getTime() / 1000),
    suggestions: toSuggestions(row),
  };
}

/** Derive an approve payload from the stored suggestions (bulk approve path). */
function suggestionToApproval(s: ReviewSuggestions): ReviewApprove {
  return {
    title: s.title,
    tagNames: s.tags.map((t) => t.name),
    correspondentName: s.correspondent?.name ?? null,
    date: s.date,
  };
}
