import { z } from 'zod';
import { PROVIDER_KIND } from '../const';

export const providerKindSchema = z.enum([
  PROVIDER_KIND.OPENAI,
  PROVIDER_KIND.ANTHROPIC,
  PROVIDER_KIND.GOOGLE,
  PROVIDER_KIND.MISTRAL,
  PROVIDER_KIND.OPENAI_COMPATIBLE,
]);

/** Provider config as exposed to the web UI — note: the API key is NEVER returned. */
export const providerConfigSchema = z.object({
  id: z.number().int().optional(),
  name: z.string().min(1),
  kind: providerKindSchema,
  baseUrl: z.string().url().optional(),
  model: z.string().min(1),
});
export type ProviderConfig = z.infer<typeof providerConfigSchema>;

/** Write payload for creating/updating a provider — includes the key (write-only). */
export const providerInputSchema = providerConfigSchema.extend({
  apiKey: z.string().min(1),
});
export type ProviderInput = z.infer<typeof providerInputSchema>;

/** Connection to the paperless-ngx instance. */
export const paperlessConnectionSchema = z.object({
  baseUrl: z.string().url(),
  apiVersion: z.number().int().positive().default(9),
});
export type PaperlessConnection = z.infer<typeof paperlessConnectionSchema>;

export const paperlessConnectionInputSchema = paperlessConnectionSchema.extend({
  token: z.string().min(1),
});
export type PaperlessConnectionInput = z.infer<typeof paperlessConnectionInputSchema>;

/** Single-row application settings. */
export const settingsSchema = z.object({
  pollIntervalSec: z.number().int().min(15).default(60),
  autoApply: z.boolean().default(false),
  createNewTags: z.boolean().default(true),
  language: z.string().default('auto'),
  ocrEnabled: z.boolean().default(false),
  correspondentBlacklist: z.array(z.string()).default([]),
});
export type Settings = z.infer<typeof settingsSchema>;
