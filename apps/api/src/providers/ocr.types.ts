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
 * that follows re-reads it at ~10% of the input price. Anthropic's cache is
 * scoped to one API key and one model, and a cache WRITE costs 1.25× the normal
 * input price — so the pipeline sets this marker only when OCR and extraction
 * run on the same credential and model (see `cacheDocument` below); any other
 * pairing would pay the write surcharge with zero reads. The document part
 * always goes FIRST in the user message so both requests share an identical
 * prefix up to this part. `providerOptions` are namespaced per provider, so
 * every other provider ignores this key.
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
  /**
   * Set the Anthropic cache marker on the document block (see
   * `ANTHROPIC_CACHE_CONTROL`). The pipeline enables this only when the
   * extraction call that follows runs on the same credential + model and can
   * re-read the entry. Default off: an unread write costs 25% extra.
   */
  cacheDocument?: boolean;
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
