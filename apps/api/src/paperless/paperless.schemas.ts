import { z } from 'zod';

/**
 * Zod schemas for the paperless-ngx REST responses we consume. These validate
 * untrusted external JSON at the boundary; unknown fields are stripped, so the
 * schemas stay minimal and tolerant of paperless version drift.
 */

/** Django REST Framework's paginated list envelope. */
export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export const paginatedSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    count: z.number().int(),
    next: z.string().nullable(),
    previous: z.string().nullable(),
    results: z.array(item),
  });

export const paperlessTagSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  /** Hex background colour, e.g. "#a6cee3"; paperless picks one when omitted. */
  color: z.string().nullable().optional(),
  /** How many documents carry the tag; shown in the tags admin table. */
  document_count: z.number().int().optional(),
});
export type PaperlessTag = z.infer<typeof paperlessTagSchema>;

export const paperlessCorrespondentSchema = z.object({
  id: z.number().int(),
  name: z.string(),
});
export type PaperlessCorrespondent = z.infer<typeof paperlessCorrespondentSchema>;

export const paperlessDocumentSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  content: z.string().nullable().optional(),
  tags: z.array(z.number().int()),
  correspondent: z.number().int().nullable(),
  created: z.string(),
  added: z.string().optional(),
  /** Page count paperless computed at consume time; null/absent when unknown (gates skip it). */
  page_count: z.number().int().nullable().optional(),
  /** Original upload name, e.g. "scan_0001.pdf"; exposed to prompts as {{filename}}. */
  original_file_name: z.string().nullable().optional(),
});
export type PaperlessDocument = z.infer<typeof paperlessDocumentSchema>;

/** Minimal envelope for the connection probe — we only need the total count. */
export const documentCountSchema = z.object({ count: z.number().int() });
