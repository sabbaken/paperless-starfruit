import { Injectable, Logger } from '@nestjs/common';
import { generateText, type LanguageModel } from 'ai';
import { PROVIDER_KIND, PROVIDER_KIND_META } from '@paperless-starfruit/shared';
import { buildLanguageModel, type ResolvedProvider } from './model.factory';
import { normaliseUsage } from './llm.service';
import {
  isImageMediaType,
  normaliseMediaType,
  type OcrInput,
  type OcrOptions,
  type OcrResult,
} from './ocr.types';
import { mistralOcr, MISTRAL_OCR_MODEL_PREFIX } from './mistral-ocr.client';
import { OCR_SYSTEM, ocrInstruction } from './ocr.prompt';

/** A dense multi-page scan can transcribe to a lot of text. */
const OCR_MAX_OUTPUT_TOKENS = 8_000;

/** Provider kinds whose vision models accept a PDF `file` part directly (per the
 *  AI SDK). Mistral chat (e.g. Pixtral) and generic OpenAI-compatible endpoints
 *  only take images — a PDF must go to one of these, or to Mistral's OCR endpoint. */
const PDF_FILE_PART_KINDS = new Set<string>([
  PROVIDER_KIND.ANTHROPIC,
  PROVIDER_KIND.OPENAI,
  PROVIDER_KIND.GOOGLE,
]);

/**
 * Concrete view of `generateText` for the OCR call — we only pass a multimodal
 * user message and read `text` + `usage`. Mirrors llm.service's narrowing so the
 * SDK's heavy generics don't blow up type inference (TS2589).
 */
type GenerateTextFn = (opts: {
  model: LanguageModel;
  system?: string;
  messages: { role: 'user'; content: Array<Record<string, unknown>> }[];
  maxOutputTokens?: number;
  abortSignal?: AbortSignal;
}) => Promise<{
  text: string;
  usage: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
}>;

const generateTextFn = generateText as unknown as GenerateTextFn;

/**
 * OCR engine. Two strategies behind one interface (plan §5):
 *   - **Mistral OCR** — the dedicated, page-billed `/v1/ocr` endpoint, used when the
 *     chosen OCR model is a `mistral-ocr-*` model on a Mistral credential.
 *   - **vision-LLM OCR** — feed the original file/image to any vision-capable model
 *     via the AI SDK, reusing the same provider credentials as extraction.
 */
@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  async ocr(provider: ResolvedProvider, input: OcrInput, opts: OcrOptions): Promise<OcrResult> {
    if (isMistralOcr(provider)) return mistralOcr(provider, input, opts);
    return this.visionOcr(provider, input, opts);
  }

  private async visionOcr(
    provider: ResolvedProvider,
    input: OcrInput,
    opts: OcrOptions,
  ): Promise<OcrResult> {
    const mediaType = normaliseMediaType(input.contentType);
    const isImage = isImageMediaType(mediaType);
    // A PDF (or any non-image) is sent as a `file` part — only Anthropic/Google/OpenAI
    // accept those. Fail with an actionable message rather than an opaque provider
    // rejection when the chosen OCR model can't take a PDF. Images work everywhere.
    if (!isImage && !PDF_FILE_PART_KINDS.has(provider.kind)) {
      throw new Error(
        `${PROVIDER_KIND_META[provider.kind].label} can't OCR PDFs directly. For PDF documents, ` +
          `pick an Anthropic, Google, or OpenAI vision model, or Mistral's dedicated OCR ` +
          `(mistral-ocr-latest). This provider can only OCR image originals.`,
      );
    }
    // An image goes in an `image` part; everything else (PDFs) as a `file` part.
    const docPart = isImage
      ? { type: 'image', image: input.data, mediaType }
      : { type: 'file', data: input.data, mediaType, filename: filenameFor(mediaType) };

    const result = await generateTextFn({
      model: buildLanguageModel(provider),
      system: OCR_SYSTEM,
      messages: [
        { role: 'user', content: [{ type: 'text', text: ocrInstruction(opts.language) }, docPart] },
      ],
      maxOutputTokens: OCR_MAX_OUTPUT_TOKENS,
      abortSignal: opts.signal,
    });
    return { text: result.text, usage: normaliseUsage(result.usage) };
  }
}

function isMistralOcr(p: ResolvedProvider): boolean {
  return (
    p.kind === PROVIDER_KIND.MISTRAL &&
    p.model.toLowerCase().startsWith(MISTRAL_OCR_MODEL_PREFIX)
  );
}

function filenameFor(mediaType: string): string {
  const ext = mediaType === 'application/pdf' ? 'pdf' : (mediaType.split('/')[1] ?? 'bin');
  return `document.${ext}`;
}
