import { z } from 'zod';
import { PROMPT_KEY } from '../const';

export const promptKeySchema = z.enum([PROMPT_KEY.EXTRACTION, PROMPT_KEY.OCR]);

const promptVariableSchema = z.object({
  name: z.string(),
  label: z.string(),
  description: z.string(),
});

/** A prompt as the UI sees it: the effective body plus enough to edit + reset it. */
export const promptConfigSchema = z.object({
  key: promptKeySchema,
  label: z.string(),
  description: z.string(),
  /** The effective body — the user's override if set, otherwise the built-in default. */
  body: z.string(),
  /** The built-in default, so the editor can show/diff against it. */
  default: z.string(),
  /** True when a stored override exists (i.e. "Reset to default" is meaningful). */
  customized: z.boolean(),
  variables: z.array(promptVariableSchema),
});
export type PromptConfig = z.infer<typeof promptConfigSchema>;

/** Save payload — an empty body is rejected (use reset to return to the default). */
export const promptUpdateSchema = z.object({
  body: z.string().min(1),
});
export type PromptUpdate = z.infer<typeof promptUpdateSchema>;

/**
 * Test payload: run a (possibly unsaved) body against a real document. `body`
 * is optional — omitted, the saved/default body is used.
 */
export const promptTestInputSchema = z.object({
  documentId: z.number().int().positive(),
  body: z.string().min(1).optional(),
});
export type PromptTestInput = z.infer<typeof promptTestInputSchema>;

/**
 * Test result. `rendered` is the exact prompt sent (after variable substitution)
 * so the user can see what the model received. The extraction path returns the
 * structured object; OCR returns the transcribed text.
 */
export const promptTestResultSchema = z.object({
  rendered: z.string(),
  /** Total tokens for the run, when the provider bills by tokens. */
  tokens: z.number().int().nullable(),
  /** Present for the extraction prompt. */
  extraction: z
    .object({
      title: z.string(),
      tags: z.array(z.string()),
      correspondent: z.string().nullable(),
      date: z.string().nullable(),
    })
    .optional(),
  /** Present for the OCR prompt. */
  text: z.string().optional(),
});
export type PromptTestResult = z.infer<typeof promptTestResultSchema>;

/** A lightweight document option for the "test on a document" picker. */
export const testDocumentSchema = z.object({
  id: z.number().int(),
  title: z.string(),
});
export type TestDocument = z.infer<typeof testDocumentSchema>;
