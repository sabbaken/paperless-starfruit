import { z } from 'zod';

/**
 * Cap on the per-tag AI hint — every hint is injected into every extraction
 * prompt, so they must stay short.
 */
export const TAG_COMMENT_MAX = 500;

/** Hex background colour paperless accepts for a tag. */
const tagColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'must be a #rrggbb colour');

/**
 * One paperless tag as shown on the Tags page: the paperless-owned fields plus
 * the local `comment` — a user-written hint injected into the extraction
 * prompt so the model knows when the tag applies. `isTrigger` marks the tag
 * Starfruit itself uses to pick up documents (renaming it would orphan the
 * poller, so the UI blocks editing it).
 */
export const tagViewSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  color: z.string().nullable(),
  /** Parent tag id for nested tags (paperless-ngx ≥ 2.19); null for root tags. */
  parent: z.number().int().nullable(),
  documentCount: z.number().int().nullable(),
  comment: z.string().nullable(),
  isTrigger: z.boolean(),
  /** Hidden from the AI: never offered in prompts, never applied from suggestions. */
  hidden: z.boolean(),
});
export type TagView = z.infer<typeof tagViewSchema>;

/** Create a tag in paperless; the comment stays local. No colour → paperless picks one. */
export const tagCreateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(128),
  color: tagColorSchema.optional(),
  comment: z.string().trim().max(TAG_COMMENT_MAX).optional(),
});
export type TagCreate = z.infer<typeof tagCreateSchema>;

/**
 * Partial update: `name`/`color` go to paperless, `comment` to the local
 * store. An empty or null comment clears the hint.
 */
export const tagUpdateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(128).optional(),
  color: tagColorSchema.optional(),
  comment: z.string().trim().max(TAG_COMMENT_MAX).nullable().optional(),
  hidden: z.boolean().optional(),
});
export type TagUpdate = z.infer<typeof tagUpdateSchema>;
