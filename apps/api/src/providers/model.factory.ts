import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createMistral } from '@ai-sdk/mistral';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import { PROVIDER_KIND, type ProviderCaps, type ProviderKind } from '@paperless-starfruit/shared';

/** A credential with its secret resolved — never persisted or serialised. */
export interface ResolvedCredential {
  name: string;
  kind: ProviderKind;
  apiKey: string;
  baseUrl?: string | null;
}

/** A credential plus the chosen model — what `buildLanguageModel` needs. */
export interface ResolvedProvider extends ResolvedCredential {
  model: string;
}

/**
 * Maps a stored provider config to a concrete Vercel AI SDK language model.
 * The AI SDK is the abstraction: every kind funnels into a `create*` factory,
 * and OpenAI-compatible endpoints (Ollama / LM Studio / vLLM / OpenRouter) reuse
 * the OpenAI wire format with a custom `baseURL`.
 */
export function buildLanguageModel(p: ResolvedProvider): LanguageModel {
  const baseURL = p.baseUrl ?? undefined;
  switch (p.kind) {
    case PROVIDER_KIND.ANTHROPIC:
      return createAnthropic({ apiKey: p.apiKey, baseURL })(p.model);
    case PROVIDER_KIND.OPENAI:
      return createOpenAI({ apiKey: p.apiKey, baseURL })(p.model);
    case PROVIDER_KIND.GOOGLE:
      return createGoogleGenerativeAI({ apiKey: p.apiKey, baseURL })(p.model);
    case PROVIDER_KIND.MISTRAL:
      return createMistral({ apiKey: p.apiKey, baseURL })(p.model);
    case PROVIDER_KIND.OPENAI_COMPATIBLE:
      if (!baseURL) {
        throw new Error('An OpenAI-compatible provider requires a base URL.');
      }
      return createOpenAICompatible({
        name: p.name || 'openai-compatible',
        baseURL,
        apiKey: p.apiKey,
      })(p.model);
    default:
      // Exhaustiveness guard — a new kind must extend this switch.
      throw new Error(`Unsupported provider kind: ${String(p.kind)}`);
  }
}

/**
 * Sensible capability defaults per kind. Used as a hint for the UI and to gate
 * vision OCR later; values are conservative for OpenAI-compatible endpoints
 * since those vary wildly by backend.
 */
export function defaultCaps(kind: ProviderKind): ProviderCaps {
  switch (kind) {
    case PROVIDER_KIND.ANTHROPIC:
      return { supportsVision: true, supportsStrictSchema: true, maxContext: 200_000, billingUnit: 'tokens' };
    case PROVIDER_KIND.OPENAI:
      return { supportsVision: true, supportsStrictSchema: true, maxContext: 128_000, billingUnit: 'tokens' };
    case PROVIDER_KIND.GOOGLE:
      return { supportsVision: true, supportsStrictSchema: true, maxContext: 1_000_000, billingUnit: 'tokens' };
    case PROVIDER_KIND.MISTRAL:
      return { supportsVision: true, supportsStrictSchema: true, maxContext: 128_000, billingUnit: 'tokens' };
    case PROVIDER_KIND.OPENAI_COMPATIBLE:
      return { supportsVision: false, supportsStrictSchema: false, maxContext: 32_000, billingUnit: 'tokens' };
    default:
      return { supportsVision: false, supportsStrictSchema: false, maxContext: 32_000, billingUnit: 'tokens' };
  }
}
