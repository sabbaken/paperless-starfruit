import { z } from 'zod';
import type { ResolvedProvider } from './model.factory';
import {
  isImageMediaType,
  normaliseMediaType,
  type OcrInput,
  type OcrOptions,
  type OcrResult,
} from './ocr.types';

const MISTRAL_API_BASE = 'https://api.mistral.ai';

/** OCR model ids beginning with this route to the dedicated endpoint (vs vision-LLM OCR). */
export const MISTRAL_OCR_MODEL_PREFIX = 'mistral-ocr';

/** Tolerant view of the `/v1/ocr` response; we only need the per-page text + page count. */
const ocrResponseSchema = z.object({
  pages: z.array(z.object({ markdown: z.string() })),
  usage_info: z.object({ pages_processed: z.number().int().optional() }).nullish(),
});

/**
 * Mistral's dedicated OCR endpoint (`POST /v1/ocr`): page-billed, not token-billed.
 * The original bytes are sent inline as a base64 data URI: no public URL is needed
 * (the document lives behind a self-hosted paperless). Returns the per-page Markdown
 * joined in page order.
 */
export async function mistralOcr(
  provider: ResolvedProvider,
  input: OcrInput,
  opts: OcrOptions,
): Promise<OcrResult> {
  const base = provider.baseUrl?.replace(/\/+$/, '') || MISTRAL_API_BASE;
  const mediaType = normaliseMediaType(input.contentType);
  const dataUri = `data:${mediaType};base64,${input.data.toString('base64')}`;
  const document = isImageMediaType(mediaType)
    ? { type: 'image_url', image_url: dataUri }
    : { type: 'document_url', document_url: dataUri };

  let res: Response;
  try {
    res = await fetch(`${base}/v1/ocr`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: provider.model, document, include_image_base64: false }),
      signal: opts.signal,
    });
  } catch (err) {
    throw new Error(`Could not reach Mistral OCR: ${(err as Error).message}`);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Mistral OCR responded ${res.status}: ${detail.slice(0, 300)}`);
  }

  const parsed = ocrResponseSchema.safeParse(await res.json());
  if (!parsed.success) {
    throw new Error(`Unexpected Mistral OCR response shape: ${parsed.error.message}`);
  }
  const text = parsed.data.pages.map((p) => p.markdown).join('\n\n');
  return { text, pages: parsed.data.usage_info?.pages_processed };
}
