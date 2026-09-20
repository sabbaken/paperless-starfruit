import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { DB } from '../db/db.module';
import { documentTypeComment } from '../db/schema';

/** Local per-document-type hints, keyed by the type id owned by paperless. */
@Injectable()
export class DocumentTypeCommentsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  map(): Map<number, string> {
    const rows = this.db.select().from(documentTypeComment).all();
    return new Map(rows.map((row) => [row.documentTypeId, row.comment]));
  }

  get(documentTypeId: number): string | null {
    const row = this.db
      .select()
      .from(documentTypeComment)
      .where(eq(documentTypeComment.documentTypeId, documentTypeId))
      .get();
    return row?.comment ?? null;
  }

  set(documentTypeId: number, comment: string | null): void {
    const trimmed = comment?.trim();
    if (!trimmed) {
      this.db
        .delete(documentTypeComment)
        .where(eq(documentTypeComment.documentTypeId, documentTypeId))
        .run();
      return;
    }
    this.db
      .insert(documentTypeComment)
      .values({ documentTypeId, comment: trimmed })
      .onConflictDoUpdate({
        target: documentTypeComment.documentTypeId,
        set: { comment: trimmed, updatedAt: new Date() },
      })
      .run();
  }
}
