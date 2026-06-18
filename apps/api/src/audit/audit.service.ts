import { Inject, Injectable } from '@nestjs/common';
import { DB } from '../db/db.module';
import type { Db } from '../db/client';
import { auditLog } from '../db/schema';

export interface AuditEntry {
  jobId?: number | null;
  documentId: number;
  prompt?: string | null;
  rawOutput?: string | null;
  result?: unknown;
  tokensCost?: number | null;
  /** What happened, e.g. 'auto-applied', 'review-queued', 'skipped', 'approved'. */
  decision: string;
}

/** Append-only record of every processing/approval run. */
@Injectable()
export class AuditService {
  constructor(@Inject(DB) private readonly db: Db) {}

  record(entry: AuditEntry): void {
    this.db
      .insert(auditLog)
      .values({
        jobId: entry.jobId ?? null,
        documentId: entry.documentId,
        prompt: entry.prompt ?? null,
        rawOutput: entry.rawOutput ?? null,
        result: entry.result ?? null,
        tokensCost: entry.tokensCost ?? null,
        decision: entry.decision,
      })
      .run();
  }
}
