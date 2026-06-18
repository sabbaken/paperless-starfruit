import { z } from 'zod';
import { providerKindSchema } from './config';

export const modelInfoSchema = z.object({
  id: z.string(),
  label: z.string(),
  vision: z.boolean(),
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

/** Everything the model picker shows, split into its two tabs. */
export const availableModelsSchema = z.object({
  api: z.array(providerModelsSchema),
  local: z.array(providerModelsSchema),
});
export type AvailableModels = z.infer<typeof availableModelsSchema>;
