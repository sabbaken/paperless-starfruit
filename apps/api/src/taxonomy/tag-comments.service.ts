import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { DB } from '../db/db.module';
import { tagComment } from '../db/schema';

/**
 * Local store for per-tag AI hints. Paperless tags carry no such field, so the
 * hints live in Starfruit's own SQLite, keyed by paperless's tag id; a row for
 * an id paperless no longer knows is simply never surfaced.
 */
@Injectable()
export class TagCommentsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** All hints as tagId → comment, for joining onto a fetched tag list. */
  map(): Map<number, string> {
    const rows = this.db.select().from(tagComment).all();
    return new Map(rows.map((r) => [r.tagId, r.comment]));
  }

  /** One tag's hint, or null when it has none. */
  get(tagId: number): string | null {
    const row = this.db.select().from(tagComment).where(eq(tagComment.tagId, tagId)).get();
    return row?.comment ?? null;
  }

  /** Set or clear one tag's hint. Blank/null clears (no row = no hint). */
  set(tagId: number, comment: string | null): void {
    const trimmed = comment?.trim();
    if (!trimmed) {
      this.db.delete(tagComment).where(eq(tagComment.tagId, tagId)).run();
      return;
    }
    this.db
      .insert(tagComment)
      .values({ tagId, comment: trimmed })
      .onConflictDoUpdate({
        target: tagComment.tagId,
        set: { comment: trimmed, updatedAt: new Date() },
      })
      .run();
  }
}
