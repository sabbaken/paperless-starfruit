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
  title: z
    .string()
    .min(1)
    .describe('A concise, human-readable document title.'),
  tags: z
    .array(z.string().min(1))
    .describe('Relevant topical tags for the document.'),
  correspondent: z
    .string()
    .min(1)
    .nullable()
    .describe('The sender / issuer of the document, or null if none is evident.'),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be ISO 8601 (YYYY-MM-DD)')
    .nullable()
    .describe('The document date in YYYY-MM-DD form, or null if none is evident.'),
});

export type Extraction = z.infer<typeof extractionSchema>;
