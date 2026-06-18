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
