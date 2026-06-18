import { z } from 'zod';
import { PROVIDER_KIND } from '../const';

export const providerKindSchema = z.enum([
  PROVIDER_KIND.OPENAI,
  PROVIDER_KIND.ANTHROPIC,
  PROVIDER_KIND.GOOGLE,
  PROVIDER_KIND.MISTRAL,
  PROVIDER_KIND.OPENAI_COMPATIBLE,
]);

/**
 * Capability flags resolved from the provider kind. They drive behaviour rather
 * than assumptions — e.g. `supportsVision` gates vision-LLM OCR (M5), and
 * `billingUnit` decides how cost is surfaced.
 */
export const providerCapsSchema = z.object({
  supportsVision: z.boolean(),
  supportsStrictSchema: z.boolean(),
  maxContext: z.number().int().positive(),
  billingUnit: z.enum(['tokens', 'pages']),
});
export type ProviderCaps = z.infer<typeof providerCapsSchema>;

/** Blank strings from form fields collapse to `undefined` before URL validation. */
const optionalUrl = z.preprocess(
  (v) => (v === '' || v == null ? undefined : v),
  z.string().url().optional(),
);

/** The user-editable, non-secret fields of a provider. */
const providerFieldsSchema = z.object({
  name: z.string().min(1),
  kind: providerKindSchema,
  baseUrl: optionalUrl,
  model: z.string().min(1),
});

/** Provider as exposed to the web UI — the API key is NEVER returned. */
export const providerConfigSchema = providerFieldsSchema.extend({
  id: z.number().int(),
  caps: providerCapsSchema,
});
export type ProviderConfig = z.infer<typeof providerConfigSchema>;

/** Create payload — the key is required and write-only. */
export const providerInputSchema = providerFieldsSchema.extend({
  apiKey: z.string().min(1),
});
export type ProviderInput = z.infer<typeof providerInputSchema>;

/** Update payload — a blank key means "keep the stored one". */
export const providerUpdateSchema = providerFieldsSchema.extend({
  apiKey: z.string().min(1).optional(),
});
export type ProviderUpdate = z.infer<typeof providerUpdateSchema>;

/**
 * Test payload. A candidate connection carries its own `apiKey`; testing an
 * already-saved provider sends its `id` so the server uses the stored key.
 */
export const providerTestInputSchema = providerFieldsSchema.extend({
  apiKey: z.string().min(1).optional(),
  id: z.number().int().optional(),
});
export type ProviderTestInput = z.infer<typeof providerTestInputSchema>;

export const providerTestResultSchema = z.object({
  ok: z.boolean(),
  error: z.string().optional(),
  latencyMs: z.number().int().optional(),
});
export type ProviderTestResult = z.infer<typeof providerTestResultSchema>;

/** Connection to the paperless-ngx instance. */
export const paperlessConnectionSchema = z.object({
  baseUrl: z.string().url(),
  // Optional override. Left blank, the API version is auto-detected from the
  // server's `X-Api-Version` on connect (paperless rejects an unsupported pin
  // with 406), then stored and pinned for subsequent requests.
  apiVersion: z.number().int().positive().optional(),
});
export type PaperlessConnection = z.infer<typeof paperlessConnectionSchema>;

export const paperlessConnectionInputSchema = paperlessConnectionSchema.extend({
  token: z.string().min(1),
});
export type PaperlessConnectionInput = z.infer<typeof paperlessConnectionInputSchema>;

/** Token-free view of the stored connection (GET /api/connection). */
export const connectionStatusSchema = z.discriminatedUnion('connected', [
  z.object({ connected: z.literal(false) }),
  z.object({
    connected: z.literal(true),
    baseUrl: z.string().url(),
    apiVersion: z.number().int(),
  }),
]);
export type ConnectionStatus = z.infer<typeof connectionStatusSchema>;

/** Result of probing a paperless instance (POST /api/connection/test). */
export const connectionTestResultSchema = z.object({
  ok: z.boolean(),
  documentCount: z.number().int().optional(),
  version: z.string().optional(),
  error: z.string().optional(),
});
export type ConnectionTestResult = z.infer<typeof connectionTestResultSchema>;

/** Single-row application settings. */
export const settingsSchema = z.object({
  pollIntervalSec: z.number().int().min(15).default(60),
  autoApply: z.boolean().default(false),
  createNewTags: z.boolean().default(true),
  language: z.string().default('auto'),
  ocrEnabled: z.boolean().default(false),
  correspondentBlacklist: z.array(z.string()).default([]),
  /** Which provider the extraction pipeline uses; null until one is chosen. */
  defaultProviderId: z.number().int().nullable().default(null),
});
export type Settings = z.infer<typeof settingsSchema>;

/** PATCH payload for settings — every field optional, validated where present. */
export const settingsUpdateSchema = settingsSchema.partial();
export type SettingsUpdate = z.infer<typeof settingsUpdateSchema>;
