import { z } from 'zod';
import { PROVIDER_KIND, type ProviderKind } from '../const';
import { providerKindSchema } from './config';

export const modelInfoSchema = z.object({
  id: z.string(),
  label: z.string(),
  vision: z.boolean(),
  /** Coarse 0–5 "how smart" rating; null when unknown (e.g. local endpoints). */
  intelligence: z.number().min(0).max(5).nullable(),
  /** USD per token (input/output); null when unknown (e.g. local endpoints). */
  pricing: z.object({ input: z.number(), output: z.number() }).nullable(),
});
export type ModelInfo = z.infer<typeof modelInfoSchema>;

/** Models offered by one configured credential. */
export const providerModelsSchema = z.object({
  providerId: z.number().int(),
  providerName: z.string(),
  kind: providerKindSchema,
  /** True when a local endpoint couldn't be listed. The UI lets the user type a model id. */
  manual: z.boolean(),
  models: z.array(modelInfoSchema),
});
export type ProviderModels = z.infer<typeof providerModelsSchema>;

/**
 * Dedicated OCR models: not chat/language models, so they never come back from
 * the language-model catalog or a `/models` probe. The OCR model picker injects
 * these per provider kind so they're selectable; the language-model picker never
 * shows them. Mistral OCR (`mistral-ocr-latest`) is page-billed, so it carries no
 * per-token pricing. Marked `vision: true` so the picker's OCR (vision-only)
 * filter keeps them.
 */
export const OCR_MODELS: Partial<Record<ProviderKind, ModelInfo[]>> = {
  [PROVIDER_KIND.MISTRAL]: [
    {
      id: 'mistral-ocr-latest',
      label: 'Mistral OCR',
      vision: true,
      intelligence: null,
      pricing: null,
    },
  ],
};

/** Everything the model picker shows: connected credentials' models, plus a
 *  per-kind catalog of every supported-vendor model (used to preview providers
 *  the user hasn't connected yet). Keyed by provider kind. */
export const availableModelsSchema = z.object({
  api: z.array(providerModelsSchema),
  local: z.array(providerModelsSchema),
  catalog: z.record(z.string(), z.array(modelInfoSchema)),
});
export type AvailableModels = z.infer<typeof availableModelsSchema>;
