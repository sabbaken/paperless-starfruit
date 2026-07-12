import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, or, sql, type SQL } from 'drizzle-orm';
import type {
  AuditEntryDetail,
  AuditEntrySummary,
  AuditList,
  AuditQuery,
} from '@paperless-starfruit/shared';
import { DB } from '../db/db.module';
import type { Db } from '../db/client';
import { auditLog, type AuditLog } from '../db/schema';

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

/** Append-only record of every processing/approval run, plus a read path for the history UI. */
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

  /**
   * A filtered, paginated page of audit rows for the history list. Returns
   * metadata only; `hasDetail` is computed in SQL so the (potentially large)
   * prompt/output text isn't shipped for every row; fetch one via {@link get}.
   */
  list(query: AuditQuery): AuditList {
    const where = this.filters(query);

    const rows = this.db
      .select({
        id: auditLog.id,
        jobId: auditLog.jobId,
        documentId: auditLog.documentId,
        decision: auditLog.decision,
        tokensCost: auditLog.tokensCost,
        hasDetail: sql<number>`(${auditLog.prompt} is not null or ${auditLog.rawOutput} is not null)`,
        createdAt: auditLog.createdAt,
      })
      .from(auditLog)
      .where(where)
      .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
      .limit(query.limit)
      .offset(query.offset)
      .all();

    const total =
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(auditLog)
        .where(where)
        .all()[0]?.count ?? 0;

    const items: AuditEntrySummary[] = rows.map((r) => ({
      id: r.id,
      jobId: r.jobId ?? null,
      documentId: r.documentId,
      decision: r.decision ?? null,
      tokensCost: r.tokensCost ?? null,
      hasDetail: !!r.hasDetail,
      createdAt: toUnix(r.createdAt),
    }));

    return { items, total };
  }

  /** Full detail for one entry: the exact prompt sent and the model's full response. */
  get(id: number): AuditEntryDetail | null {
    const row = this.db.select().from(auditLog).where(eq(auditLog.id, id)).all()[0];
    return row ? toDetail(row) : null;
  }

  /** Build the combined WHERE for the document/decision/text-search filters. */
  private filters(query: AuditQuery): SQL | undefined {
    const clauses: SQL[] = [];
    if (query.documentId != null) clauses.push(eq(auditLog.documentId, query.documentId));
    if (query.decision) clauses.push(eq(auditLog.decision, query.decision));
    const q = query.q?.trim();
    if (q) {
      // A plain case-insensitive LIKE over the prompt + model output, enough to
      // find "which run mentioned X" at single-user scale (no FTS needed). Treat
      // the query as a literal substring: escape LIKE's `%`/`_` wildcards (and the
      // escape char) and pair with an explicit ESCAPE; drizzle's like() omits it,
      // so use a raw fragment.
      const term = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
      const match = or(
        sql`${auditLog.prompt} like ${term} escape '\\'`,
        sql`${auditLog.rawOutput} like ${term} escape '\\'`,
      );
      if (match) clauses.push(match);
    }
    if (clauses.length === 0) return undefined;
    return clauses.length === 1 ? clauses[0] : and(...clauses);
  }
}

function toDetail(r: AuditLog): AuditEntryDetail {
  return {
    id: r.id,
    jobId: r.jobId ?? null,
    documentId: r.documentId,
    decision: r.decision ?? null,
    tokensCost: r.tokensCost ?? null,
    hasDetail: r.prompt != null || r.rawOutput != null,
    createdAt: toUnix(r.createdAt),
    prompt: r.prompt ?? null,
    rawOutput: r.rawOutput ?? null,
    result: r.result ?? null,
  };
}

/** Match the JobSummary convention: emit timestamps as unix seconds. */
function toUnix(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}
