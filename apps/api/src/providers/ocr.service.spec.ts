import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OcrService } from './ocr.service';
import type { ResolvedProvider } from './model.factory';

// Mock the AI SDK so the vision path makes no network call. We also stub the
// structured-output exports so importing llm.service (for normaliseUsage) is safe.
const { generateTextMock } = vi.hoisted(() => ({ generateTextMock: vi.fn() }));
vi.mock('ai', () => ({
  generateText: generateTextMock,
  generateObject: vi.fn(),
  NoObjectGeneratedError: class {
    static isInstance() {
      return false;
    }
  },
  JSONParseError: class {
    static isInstance() {
      return false;
    }
  },
  TypeValidationError: class {
    static isInstance() {
      return false;
    }
  },
}));

const VISION: ResolvedProvider = {
  name: 'Anthropic',
  kind: 'anthropic',
  apiKey: 'k',
  baseUrl: null,
  model: 'claude-haiku-4-5',
};
const MISTRAL_OCR: ResolvedProvider = {
  name: 'Mistral',
  kind: 'mistral',
  apiKey: 'mk',
  baseUrl: null,
  model: 'mistral-ocr-latest',
};
const OPTS = { language: 'auto' };

describe('OcrService — vision-LLM OCR', () => {
  beforeEach(() => generateTextMock.mockReset());

  it('sends a PDF as a file part and returns text + normalised usage', async () => {
    generateTextMock.mockResolvedValue({
      text: 'recognised text',
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    });

    const out = await new OcrService().ocr(
      VISION,
      { data: Buffer.from('%PDF-1.4'), contentType: 'application/pdf' },
      OPTS,
    );

    expect(out.text).toBe('recognised text');
    expect(out.usage).toEqual({ inputTokens: 10, outputTokens: 5, totalTokens: 15 });

    const parts = generateTextMock.mock.calls[0][0].messages[0].content;
    expect(parts[0]).toMatchObject({ type: 'text' });
    expect(parts[1]).toMatchObject({ type: 'file', mediaType: 'application/pdf' });
    expect(parts[1].data).toBeInstanceOf(Buffer);
  });

  it('sends an image as an image part', async () => {
    generateTextMock.mockResolvedValue({ text: 'x', usage: {} });

    await new OcrService().ocr(
      VISION,
      { data: Buffer.from('PNGDATA'), contentType: 'image/png' },
      OPTS,
    );

    const parts = generateTextMock.mock.calls[0][0].messages[0].content;
    expect(parts[1]).toMatchObject({ type: 'image', mediaType: 'image/png' });
    expect(parts[1].image).toBeInstanceOf(Buffer);
  });

  it('defaults an unknown/opaque content type to PDF', async () => {
    generateTextMock.mockResolvedValue({ text: 'x', usage: {} });

    await new OcrService().ocr(
      VISION,
      { data: Buffer.from('x'), contentType: 'application/octet-stream' },
      OPTS,
    );

    const parts = generateTextMock.mock.calls[0][0].messages[0].content;
    expect(parts[1]).toMatchObject({ type: 'file', mediaType: 'application/pdf' });
  });

  it('rejects a PDF for a provider that cannot accept PDF file parts (clear error)', async () => {
    const pixtral: ResolvedProvider = {
      name: 'Mistral',
      kind: 'mistral',
      apiKey: 'k',
      baseUrl: null,
      model: 'pixtral-large-latest',
    };
    await expect(
      new OcrService().ocr(
        pixtral,
        { data: Buffer.from('%PDF'), contentType: 'application/pdf' },
        OPTS,
      ),
    ).rejects.toThrow(/can't OCR PDFs/i);
    expect(generateTextMock).not.toHaveBeenCalled();
  });

  it('still OCRs an image for a non-PDF-capable provider', async () => {
    const pixtral: ResolvedProvider = {
      name: 'Mistral',
      kind: 'mistral',
      apiKey: 'k',
      baseUrl: null,
      model: 'pixtral-large-latest',
    };
    generateTextMock.mockResolvedValue({ text: 'ok', usage: {} });
    const out = await new OcrService().ocr(
      pixtral,
      { data: Buffer.from('img'), contentType: 'image/png' },
      OPTS,
    );
    expect(out.text).toBe('ok');
    expect(generateTextMock).toHaveBeenCalledOnce();
  });
});

describe('OcrService — Mistral OCR endpoint', () => {
  beforeEach(() => generateTextMock.mockReset());
  afterEach(() => vi.unstubAllGlobals());

  it('POSTs a base64 data URI to /v1/ocr and joins page markdown in order', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        pages: [{ markdown: 'page one' }, { markdown: 'page two' }],
        usage_info: { pages_processed: 2 },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const out = await new OcrService().ocr(
      MISTRAL_OCR,
      { data: Buffer.from('%PDF'), contentType: 'application/pdf' },
      OPTS,
    );

    // Dedicated endpoint — the vision-LLM path is not used.
    expect(generateTextMock).not.toHaveBeenCalled();
    expect(out.text).toBe('page one\n\npage two');
    expect(out.pages).toBe(2);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.mistral.ai/v1/ocr');
    expect(init.headers.Authorization).toBe('Bearer mk');
    const body = JSON.parse(init.body);
    expect(body.model).toBe('mistral-ocr-latest');
    expect(body.document.type).toBe('document_url');
    expect(body.document.document_url).toMatch(/^data:application\/pdf;base64,/);
  });

  it('uses the image_url variant for an image', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ pages: [{ markdown: 'ocr' }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await new OcrService().ocr(
      MISTRAL_OCR,
      { data: Buffer.from('img'), contentType: 'image/jpeg' },
      OPTS,
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.document.type).toBe('image_url');
    expect(body.document.image_url).toMatch(/^data:image\/jpeg;base64,/);
  });

  it('throws on a non-OK Mistral OCR response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => 'unauthorized' }),
    );
    await expect(
      new OcrService().ocr(
        MISTRAL_OCR,
        { data: Buffer.from('x'), contentType: 'application/pdf' },
        OPTS,
      ),
    ).rejects.toThrow(/401/);
  });
});
