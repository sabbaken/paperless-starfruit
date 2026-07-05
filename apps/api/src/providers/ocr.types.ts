import { PROVIDER_KIND } from '@paperless-starfruit/shared';
import type { LlmUsage } from './llm.service';

/** Provider kinds whose vision models accept a PDF `file` part directly (per the
 *  AI SDK). Mistral chat (e.g. Pixtral) and generic OpenAI-compatible endpoints
 *  only take images — a PDF must go to one of these, or to Mistral's OCR endpoint. */
export const PDF_FILE_PART_KINDS = new Set<string>([
  PROVIDER_KIND.ANTHROPIC,
  PROVIDER_KIND.OPENAI,
  PROVIDER_KIND.GOOGLE,
]);

/**
 * Marks a content part as an Anthropic prompt-cache breakpoint (5-minute TTL).
 * The OCR call writes the document block into the cache and the extraction call
 * that follows re-reads it at ~10% of the input price — provided both requests
 * share the same model and an identical prefix up to this part, which is why the
 * document part always goes FIRST in the user message. `providerOptions` are
 * namespaced per provider, so every other provider ignores this key.
 */
export const ANTHROPIC_CACHE_CONTROL = {
  anthropic: { cacheControl: { type: 'ephemeral' } },
} as const;

/** The original document bytes pulled from paperless, plus its declared type. */
export interface OcrInput {
  data: Buffer;
  /** From paperless's `Content-Type` response header; may be null/unknown. */
  contentType: string | null;
}

export interface OcrOptions {
  /** Output-language hint from settings ('auto' or a language name). */
  language: string;
  /**
   * The rendered, user-editable OCR prompt (M6) sent as the instruction text for
   * vision-LLM OCR. The dedicated Mistral OCR endpoint ignores it. Falls back to a
   * built-in instruction when omitted (e.g. in unit tests).
   */
  prompt?: string;
  signal?: AbortSignal;
}

export interface OcrResult {
  text: string;
  /** Token usage for vision-LLM OCR; undefined for page-billed engines (Mistral OCR). */
  usage?: LlmUsage;
  /** Pages processed for page-billed engines; undefined for token-billed ones. */
  pages?: number;
}

/**
 * Normalise a `Content-Type` header to a bare media type. Defaults to PDF —
 * paperless originals are overwhelmingly PDFs — when the header is missing or
 * opaque (`application/octet-stream`), so a vision/OCR call still gets a usable
 * media type instead of one a provider would reject.
 */
export function normaliseMediaType(contentType: string | null): string {
  const mt = contentType?.split(';')[0]?.trim().toLowerCase();
  if (!mt || mt === 'application/octet-stream') return 'application/pdf';
  return mt;
}

export function isImageMediaType(mediaType: string): boolean {
  return mediaType.startsWith('image/');
}
