import { z } from 'zod';

/**
 * The audit log is the debugging surface: it captures, per processing run, the
 * exact prompt sent to the LLM (with the document content substituted in) and
 * the model's full response, so a misclassification can be traced to what the
 * model actually saw and said. Skips/approvals are recorded too but carry no
 * prompt/output, hence the nullable fields and the `hasDetail` flag.
 */

/** Decisions the pipeline/review record: the values worth filtering the log by. */
export const AUDIT_DECISIONS = [
  'auto-applied',
  'review-queued',
  'ocr-only',
  'skipped',
  'approved',
  'rejected',
] as const;

/** A single audit row as shown in the history list: metadata only, no heavy prompt/output. */
export const auditEntrySummarySchema = z.object({
  id: z.number().int(),
  jobId: z.number().int().nullable(),
  documentId: z.number().int(),
  decision: z.string().nullable(),
  tokensCost: z.number().int().nullable(),
  /** True when this row carries a prompt + model output to inspect (skips/approvals don't). */
  hasDetail: z.boolean(),
  createdAt: z.number().int(),
});
export type AuditEntrySummary = z.infer<typeof auditEntrySummarySchema>;

/** Full detail: the exact prompt sent and the model's full response, for debugging. */
export const auditEntryDetailSchema = auditEntrySummarySchema.extend({
  prompt: z.string().nullable(),
  rawOutput: z.string().nullable(),
  result: z.unknown(),
});
export type AuditEntryDetail = z.infer<typeof auditEntryDetailSchema>;

/** A page of audit entries plus the total matching the filter (for pagination). */
export const auditListSchema = z.object({
  items: z.array(auditEntrySummarySchema),
  total: z.number().int(),
});
export type AuditList = z.infer<typeof auditListSchema>;

/**
 * Query params for the audit list. `z.coerce` turns the raw query strings into
 * numbers and applies the limit/offset defaults, so the controller can hand the
 * whole `@Query()` object straight to the validation pipe.
 */
export const auditQuerySchema = z.object({
  documentId: z.coerce.number().int().positive().optional(),
  decision: z.string().min(1).optional(),
  /** Free-text match over the prompt + model output (case-insensitive LIKE). */
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type AuditQuery = z.infer<typeof auditQuerySchema>;
