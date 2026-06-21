import type { LlmUsage } from './llm.service';

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
