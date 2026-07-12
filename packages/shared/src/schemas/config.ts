import { z } from 'zod';
import { PROVIDER_KIND, PROVIDER_KIND_META } from '../const';

export const providerKindSchema = z.enum([
  PROVIDER_KIND.OPENAI,
  PROVIDER_KIND.ANTHROPIC,
  PROVIDER_KIND.GOOGLE,
  PROVIDER_KIND.MISTRAL,
  PROVIDER_KIND.OPENAI_COMPATIBLE,
]);

/**
 * Capability flags resolved from the provider kind. They drive behaviour rather
 * than assumptions: e.g. `supportsVision` gates vision-LLM OCR (M5), and
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

/**
 * The user-editable, non-secret fields of a credential. A credential is now just
 * an API key (or local endpoint) per provider. The model is chosen separately,
 * in processing settings.
 */
const providerFieldsSchema = z.object({
  name: z.string().min(1),
  kind: providerKindSchema,
  baseUrl: optionalUrl,
});

/** Local (OpenAI-compatible) endpoints require a base URL; cloud kinds require a key. */
const requireKeyAndUrl = (
  v: { kind: z.infer<typeof providerKindSchema>; baseUrl?: string; apiKey?: string },
  ctx: z.RefinementCtx,
  keyRequired: boolean,
) => {
  const meta = PROVIDER_KIND_META[v.kind];
  if (meta.needsBaseUrl && !v.baseUrl) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['baseUrl'],
      message: 'Base URL is required',
    });
  }
  if (keyRequired && meta.keyRequired && !v.apiKey) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['apiKey'], message: 'API key is required' });
  }
};

/** Credential as exposed to the web UI. The API key is NEVER returned. */
export const providerConfigSchema = providerFieldsSchema.extend({
  id: z.number().int(),
  caps: providerCapsSchema,
});
export type ProviderConfig = z.infer<typeof providerConfigSchema>;

/** Create payload: key required for cloud kinds, optional for local. */
export const providerInputSchema = providerFieldsSchema
  .extend({ apiKey: z.string().optional() })
  .superRefine((v, ctx) => requireKeyAndUrl(v, ctx, true));
export type ProviderInput = z.infer<typeof providerInputSchema>;

/** Update payload: a blank key means "keep the stored one". */
export const providerUpdateSchema = providerFieldsSchema
  .extend({ apiKey: z.string().optional() })
  .superRefine((v, ctx) => requireKeyAndUrl(v, ctx, false));
export type ProviderUpdate = z.infer<typeof providerUpdateSchema>;

/**
 * Test payload. A candidate carries its own `apiKey`; testing an already-saved
 * credential sends its `id` so the server uses the stored key.
 */
export const providerTestInputSchema = providerFieldsSchema.extend({
  apiKey: z.string().optional(),
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
  /** Master switch: when true the poller stops enqueuing and the worker stops
   * claiming, so document processing halts until resumed (an in-flight job finishes). */
  paused: z.boolean().default(false),
  pollIntervalSec: z.number().int().min(15).default(60),
  autoApply: z.boolean().default(true),
  createNewTags: z.boolean().default(false),
  createNewCorrespondents: z.boolean().default(true),
  /** Run LLM metadata extraction; off = OCR-only mode (text write-back, no metadata). */
  extractionEnabled: z.boolean().default(true),
  /** Skip extraction (and OCR) for documents with more pages than this. `null` = no limit. */
  extractMaxPages: z.number().int().positive().nullable().default(100),
  language: z.string().default('auto'),
  ocrEnabled: z.boolean().default(true),
  /**
   * The "too big for a vision model" threshold, doing double duty: documents
   * with more pages than this skip OCR (paperless's own text is reused) AND
   * attach only their first and last pages to extraction instead of the whole
   * original. `null` = no limit.
   */
  ocrMaxPages: z.number().int().positive().nullable().default(20),
  correspondentBlacklist: z.array(z.string()).default([]),
  /** The credential + model the extraction pipeline runs on; null until chosen. */
  llmProviderId: z.number().int().nullable().default(null),
  llmModel: z.string().nullable().default(null),
  /** The credential + model used for OCR (wired up in M5); chosen ahead of time. */
  ocrProviderId: z.number().int().nullable().default(null),
  ocrModel: z.string().nullable().default(null),
  /** Periodically check GitHub for a newer release and surface a notice. */
  checkForUpdates: z.boolean().default(true),
});
export type Settings = z.infer<typeof settingsSchema>;

/** PATCH payload for settings: every field optional, validated where present. */
export const settingsUpdateSchema = settingsSchema.partial();
export type SettingsUpdate = z.infer<typeof settingsUpdateSchema>;
