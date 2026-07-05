import { Injectable, Logger } from '@nestjs/common';
import { generateText, type LanguageModel } from 'ai';
import { PROVIDER_KIND, PROVIDER_KIND_META } from '@paperless-starfruit/shared';
import { buildLanguageModel, type ResolvedProvider } from './model.factory';
import { normaliseUsage } from './llm.service';
import {
  ANTHROPIC_CACHE_CONTROL,
  PDF_FILE_PART_KINDS,
  isImageMediaType,
  normaliseMediaType,
  type OcrInput,
  type OcrOptions,
  type OcrResult,
} from './ocr.types';
import { mistralOcr, MISTRAL_OCR_MODEL_PREFIX } from './mistral-ocr.client';

/** A dense multi-page scan can transcribe to a lot of text. */
const OCR_MAX_OUTPUT_TOKENS = 8_000;

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
    // The cache marker turns the document block into an Anthropic prompt-cache
    // entry that the extraction call re-reads at ~10% cost (see ocr.types).
    const docPart = isImage
      ? { type: 'image', image: input.data, mediaType, providerOptions: ANTHROPIC_CACHE_CONTROL }
      : {
          type: 'file',
          data: input.data,
          mediaType,
          filename: filenameFor(mediaType),
          providerOptions: ANTHROPIC_CACHE_CONTROL,
        };

    // The user-editable OCR prompt (M6) carries all the transcription instructions
    // and goes in the user message alongside the file — so what the user edits is
    // exactly what the model receives. Fall back to a built-in instruction when no
    // prompt is supplied (the pipeline always renders one; this guards tests).
    // Document BEFORE instruction: the document block must be a stable prefix
    // shared with the extraction request for the cache to hit (and it matches
    // Anthropic's recommended document-first layout).
    const instruction = opts.prompt ?? fallbackOcrPrompt(opts.language);
    const result = await generateTextFn({
      model: buildLanguageModel(provider),
      messages: [{ role: 'user', content: [docPart, { type: 'text', text: instruction }] }],
      maxOutputTokens: OCR_MAX_OUTPUT_TOKENS,
      abortSignal: opts.signal,
    });
    return { text: result.text, usage: normaliseUsage(result.usage) };
  }
}

/** Minimal default instruction when no rendered prompt is provided. */
function fallbackOcrPrompt(language: string): string {
  const hint = language && language !== 'auto' ? ` The document is mainly in ${language}.` : '';
  return `Transcribe all text from the attached document verbatim. Output only the document text — no preamble or commentary.${hint}`;
}

function isMistralOcr(p: ResolvedProvider): boolean {
  return (
    p.kind === PROVIDER_KIND.MISTRAL && p.model.toLowerCase().startsWith(MISTRAL_OCR_MODEL_PREFIX)
  );
}

function filenameFor(mediaType: string): string {
  const ext = mediaType === 'application/pdf' ? 'pdf' : (mediaType.split('/')[1] ?? 'bin');
  return `document.${ext}`;
}
