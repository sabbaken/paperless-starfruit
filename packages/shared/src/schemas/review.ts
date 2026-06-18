import { z } from 'zod';

/**
 * A suggested tag/correspondent resolved against the paperless taxonomy.
 * `id` is null when no existing entity matched — `isNew` then means "will be
 * created on apply" (in review mode creation is deferred until the user approves).
 */
export const resolvedTagSchema = z.object({
  id: z.number().int().nullable(),
  name: z.string(),
  isNew: z.boolean(),
});
export type ResolvedTag = z.infer<typeof resolvedTagSchema>;

export const resolvedCorrespondentSchema = resolvedTagSchema;
export type ResolvedCorrespondent = z.infer<typeof resolvedCorrespondentSchema>;

/** The document's metadata before processing — the left-hand side of the diff. */
export const reviewCurrentSchema = z.object({
  title: z.string(),
  tagNames: z.array(z.string()),
  correspondentName: z.string().nullable(),
  date: z.string().nullable(),
});

/**
 * What the pipeline produced for one document, persisted on the review_item so
 * the Review UI can render a current-vs-suggested diff and let the user edit
 * before applying.
 */
export const reviewSuggestionsSchema = z.object({
  title: z.string(),
  tags: z.array(resolvedTagSchema),
  correspondent: resolvedCorrespondentSchema.nullable(),
  date: z.string().nullable(),
  current: reviewCurrentSchema,
});
export type ReviewSuggestions = z.infer<typeof reviewSuggestionsSchema>;

export const reviewStatusSchema = z.enum(['pending', 'approved', 'rejected']);

/** A review item as listed in the queue (suggestions inlined — they're small). */
export const reviewItemSchema = z.object({
  id: z.number().int(),
  documentId: z.number().int(),
  status: reviewStatusSchema,
  createdAt: z.number().int(),
  suggestions: reviewSuggestionsSchema,
});
export type ReviewItemView = z.infer<typeof reviewItemSchema>;

/** A single item plus a live text preview of the document. */
export const reviewDetailSchema = reviewItemSchema.extend({
  documentContent: z.string().nullable(),
});
export type ReviewDetail = z.infer<typeof reviewDetailSchema>;

/**
 * The user-confirmed values to apply. `tagNames` are merged with the document's
 * existing (non-trigger) tags; an empty/blank correspondent or date leaves that
 * field unchanged.
 */
export const reviewApproveSchema = z.object({
  title: z.string().min(1),
  tagNames: z.array(z.string()),
  correspondentName: z.string().nullable(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD')
    .nullable(),
});
export type ReviewApprove = z.infer<typeof reviewApproveSchema>;

export const reviewBulkApproveSchema = z.object({
  ids: z.array(z.number().int()).min(1),
});
export type ReviewBulkApprove = z.infer<typeof reviewBulkApproveSchema>;
