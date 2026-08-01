import { PDFDocument } from 'pdf-lib';
import type { ProviderKind } from '@paperless-starfruit/shared';
import { defaultCaps } from '../providers/model.factory';
import {
  ANTHROPIC_CACHE_CONTROL,
  PDF_FILE_PART_KINDS,
  encodeAttachment,
  isImageMediaType,
  normaliseMediaType,
} from '../providers/ocr.types';

/**
 * How much of the original document extraction gets to SEE, on top of the OCR
 * text: the whole file, only its first and last pages (long documents: dates,
 * letterheads and signatures live on the edges), or nothing (provider can't
 * take visual input). Decidable from settings + paperless metadata alone,
 * before the file is downloaded, so it can also feed the config fingerprint.
 */
export type VisualMode = 'full' | 'trimmed' | 'none';

export function visualMode(opts: {
  kind: ProviderKind;
  pageCount: number | null;
  /** `settings.ocrMaxPages`: the shared "too big for a vision model" limit; null = no trimming. */
  maxFullPages: number | null;
}): VisualMode {
  if (!defaultCaps(opts.kind).supportsVision) return 'none';
  if (opts.maxFullPages != null && opts.pageCount != null && opts.pageCount > opts.maxFullPages) {
    return 'trimmed';
  }
  return 'full';
}

/**
 * Build the multimodal part that carries the original document into the
 * extraction call. Mirrors the OCR call's part shape byte-for-byte (same media
 * type normalisation, same `document.pdf` filename, and, with `cacheDocument`,
 * the same cache marker) so that on Anthropic the extraction request
 * re-reads the document block the OCR request just cached instead of paying
 * full price for a second read. The pipeline sets `cacheDocument` only when
 * both calls share a credential + model, the one pairing where the cache
 * entry is actually re-read (see `ANTHROPIC_CACHE_CONTROL`).
 *
 * Returns null when this provider/file combination can't take the attachment
 * (non-image file on a kind without PDF file-part support, exotic media type,
 * a PDF that pdf-lib can't parse, or a file over `maxBytes`); extraction then
 * runs text-only, exactly as before.
 */
export async function buildExtractionFilePart(opts: {
  data: Buffer;
  contentType: string | null;
  kind: ProviderKind;
  mode: Exclude<VisualMode, 'none'>;
  cacheDocument?: boolean;
  /**
   * Largest attachment we're willing to inline (`settings.attachMaxMb`). The
   * page gates can't see bytes — 20 pages of 600-dpi colour is routinely 100+
   * MB, and `page_count` is null for image originals and older imports, which
   * switches both page gates off. Null = no byte limit.
   */
  maxBytes?: number | null;
}): Promise<Record<string, unknown> | null> {
  const mediaType = normaliseMediaType(opts.contentType);
  const cachePart = opts.cacheDocument ? { providerOptions: ANTHROPIC_CACHE_CONTROL } : {};
  const overLimit = (data: Buffer) => opts.maxBytes != null && data.byteLength > opts.maxBytes;
  if (isImageMediaType(mediaType)) {
    // Single image original: there is nothing to trim.
    if (overLimit(opts.data)) return null;
    return { type: 'image', image: encodeAttachment(opts.data), mediaType, ...cachePart };
  }
  if (mediaType !== 'application/pdf' || !PDF_FILE_PART_KINDS.has(opts.kind)) return null;
  const data = opts.mode === 'trimmed' ? await firstAndLastPages(opts.data) : opts.data;
  // Measure AFTER trimming: two pages lifted out of a huge scan are usually
  // well under the limit, and letting those through is the whole point of
  // trimming. Only the bytes we actually send have to fit.
  if (!data || overLimit(data)) return null;
  return {
    type: 'file',
    data: encodeAttachment(data),
    mediaType,
    filename: 'document.pdf',
    ...cachePart,
  };
}

/**
 * Copy the first and last pages into a fresh two-page PDF (pure-JS pdf-lib,
 * no rasterizer dependency; vision providers render PDF pages server-side
 * anyway, so the model still sees the pages). Null when the PDF can't be
 * parsed; the caller degrades to text-only extraction rather than failing
 * the job over an optional attachment.
 */
async function firstAndLastPages(data: Buffer): Promise<Buffer | null> {
  try {
    const src = await PDFDocument.load(data, { ignoreEncryption: true });
    const count = src.getPageCount();
    if (count === 0) return null;
    const out = await PDFDocument.create();
    const indices = count <= 2 ? src.getPageIndices() : [0, count - 1];
    for (const page of await out.copyPages(src, indices)) out.addPage(page);
    return Buffer.from(await out.save());
  } catch {
    return null;
  }
}
