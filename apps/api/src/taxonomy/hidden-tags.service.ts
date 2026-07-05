import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { DB } from '../db/db.module';
import { hiddenTag } from '../db/schema';

/**
 * Local store of tags hidden from the AI. Paperless has no such concept, so
 * the flag lives in Starfruit's own SQLite, keyed by paperless's tag id; a row
 * for an id paperless no longer knows is simply never surfaced.
 */
@Injectable()
export class HiddenTagsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Ids of every hidden tag, for filtering a fetched tag list. */
  ids(): Set<number> {
    const rows = this.db.select().from(hiddenTag).all();
    return new Set(rows.map((r) => r.tagId));
  }

  /** Hide or show one tag. Repeating the current state is a no-op. */
  set(tagId: number, hidden: boolean): void {
    if (hidden) {
      this.db.insert(hiddenTag).values({ tagId }).onConflictDoNothing().run();
    } else {
      this.db.delete(hiddenTag).where(eq(hiddenTag.tagId, tagId)).run();
    }
  }
}
