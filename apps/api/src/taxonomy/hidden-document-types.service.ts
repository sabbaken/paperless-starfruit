import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { DB } from '../db/db.module';
import { hiddenDocumentType } from '../db/schema';

/** Local visibility flags for the document types offered to the AI. */
@Injectable()
export class HiddenDocumentTypesService {
  constructor(@Inject(DB) private readonly db: Db) {}

  ids(): Set<number> {
    const rows = this.db.select().from(hiddenDocumentType).all();
    return new Set(rows.map((row) => row.documentTypeId));
  }

  set(documentTypeId: number, hidden: boolean): void {
    if (hidden) {
      this.db.insert(hiddenDocumentType).values({ documentTypeId }).onConflictDoNothing().run();
    } else {
      this.db
        .delete(hiddenDocumentType)
        .where(eq(hiddenDocumentType.documentTypeId, documentTypeId))
        .run();
    }
  }
}
