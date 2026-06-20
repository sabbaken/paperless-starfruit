import { z } from 'zod';
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
  /** True when a local endpoint couldn't be listed — the UI lets the user type a model id. */
  manual: z.boolean(),
  models: z.array(modelInfoSchema),
});
export type ProviderModels = z.infer<typeof providerModelsSchema>;

/** Everything the model picker shows: connected credentials' models, plus a
 *  per-kind catalog of every supported-vendor model (used to preview providers
 *  the user hasn't connected yet). Keyed by provider kind. */
export const availableModelsSchema = z.object({
  api: z.array(providerModelsSchema),
  local: z.array(providerModelsSchema),
  catalog: z.record(z.string(), z.array(modelInfoSchema)),
});
export type AvailableModels = z.infer<typeof availableModelsSchema>;
