import { z } from 'zod';

/** Schema name/description handed to providers that surface them as LLM guidance. */
export const EXTRACTION_SCHEMA_NAME = 'document_metadata';
export const EXTRACTION_SCHEMA_DESCRIPTION =
  'Title, tags, correspondent and date extracted from an archived document.';

/**
 * The structured-output contract for the metadata extraction step.
 * This SAME schema drives `generateObject` (Vercel AI SDK) and is validated
 * before anything is written back to paperless. v1 scope: title, tags,
 * correspondent, date.
 */
export const extractionSchema = z.object({
  title: z.string().min(1).describe('A concise, human-readable document title.'),
  tags: z.array(z.string().min(1)).describe('Relevant topical tags for the document.'),
  correspondent: z
    .string()
    .min(1)
    .nullable()
    .describe('The sender / issuer of the document, or null if none is evident.'),
  date: z
    .string()
    // Accept a full date, or a partial period (year, or year-month) when the
    // document exposes only a month/year and no exact day. `normalizeDocumentDate`
    // pads a partial to the first of that period before it reaches paperless.
    .regex(/^\d{4}(-\d{2}(-\d{2})?)?$/, 'must be YYYY, YYYY-MM, or YYYY-MM-DD')
    .nullable()
    .describe(
      'The document’s own date. Give YYYY-MM-DD when the day is known; if only the ' +
        'month or year is evident, give YYYY-MM or YYYY (the first of that period is ' +
        'used). null only when no date or period is evident, never today’s date.',
    ),
});

export type Extraction = z.infer<typeof extractionSchema>;

/**
 * Pad a document date to a full ISO `YYYY-MM-DD`. Documents that expose only a
 * period (monthly invoices, statements, "May 2026") yield a year or year-month;
 * default the missing month/day to `01` so paperless's day-granular `created`
 * gets set to the first of that period instead of falling back to the consume
 * date (today). Returns null for a null/blank value or an unparseable / impossible
 * date (e.g. `2026-13`, `2026-02-31`). Better no date than a wrong one.
 */
export function normalizeDocumentDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(value.trim());
  if (!match) return null;
  const [, year, month = '01', day = '01'] = match;
  const iso = `${year}-${month}-${day}`;
  // A Date round-trip that changes the value means the month/day was out of range
  // (JS would otherwise silently roll `2026-02-31` over into March).
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== iso) return null;
  return iso;
}
