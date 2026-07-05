import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { buildExtractionFilePart, visualMode } from './attachment';

const CACHE_MARKER = { anthropic: { cacheControl: { type: 'ephemeral' } } };

/** A real PDF whose pages have distinct widths (100, 200, …) so a trim's page
 *  selection is observable from the output. */
async function pdfWithPages(count: number): Promise<Buffer> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < count; i++) doc.addPage([100 * (i + 1), 500]);
  return Buffer.from(await doc.save());
}

describe('visualMode', () => {
  it('is "none" for providers without vision support', () => {
    expect(visualMode({ kind: 'openai-compatible', pageCount: 3, maxFullPages: 10 })).toBe('none');
  });

  it('is "full" within the threshold, with no threshold, or with an unknown page count', () => {
    expect(visualMode({ kind: 'anthropic', pageCount: 10, maxFullPages: 10 })).toBe('full');
    expect(visualMode({ kind: 'anthropic', pageCount: 500, maxFullPages: null })).toBe('full');
    expect(visualMode({ kind: 'anthropic', pageCount: null, maxFullPages: 10 })).toBe('full');
  });

  it('is "trimmed" above the threshold', () => {
    expect(visualMode({ kind: 'anthropic', pageCount: 11, maxFullPages: 10 })).toBe('trimmed');
  });
});

describe('buildExtractionFilePart', () => {
  it('attaches an image original as an image part with the cache marker when opted in', async () => {
    const data = Buffer.from('PNGDATA');
    const part = await buildExtractionFilePart({
      data,
      contentType: 'image/png',
      kind: 'mistral',
      mode: 'full',
      cacheDocument: true,
    });
    expect(part).toMatchObject({ type: 'image', mediaType: 'image/png' });
    expect(part?.image).toBe(data);
    expect(part?.providerOptions).toEqual(CACHE_MARKER);
  });

  it('attaches a full PDF byte-for-byte, mirroring the OCR call (cache prefix match)', async () => {
    const data = await pdfWithPages(3);
    const part = await buildExtractionFilePart({
      data,
      contentType: 'application/pdf',
      kind: 'anthropic',
      mode: 'full',
      cacheDocument: true,
    });
    expect(part).toMatchObject({
      type: 'file',
      mediaType: 'application/pdf',
      filename: 'document.pdf',
    });
    expect(part?.data).toBe(data);
    expect(part?.providerOptions).toEqual(CACHE_MARKER);
  });

  it('omits the cache marker by default (no shared entry for extraction to re-read)', async () => {
    const image = await buildExtractionFilePart({
      data: Buffer.from('PNGDATA'),
      contentType: 'image/png',
      kind: 'anthropic',
      mode: 'full',
    });
    expect(image?.providerOptions).toBeUndefined();

    const pdf = await buildExtractionFilePart({
      data: await pdfWithPages(1),
      contentType: 'application/pdf',
      kind: 'anthropic',
      mode: 'full',
    });
    expect(pdf?.providerOptions).toBeUndefined();
  });

  it('trims a long PDF to its first and last pages', async () => {
    const part = await buildExtractionFilePart({
      data: await pdfWithPages(4),
      contentType: 'application/pdf',
      kind: 'anthropic',
      mode: 'trimmed',
    });
    const trimmed = await PDFDocument.load(part?.data as Buffer);
    expect(trimmed.getPageCount()).toBe(2);
    // Page widths identify which source pages survived (100·n per page).
    expect(trimmed.getPage(0).getWidth()).toBe(100);
    expect(trimmed.getPage(1).getWidth()).toBe(400);
  });

  it('keeps a two-page PDF whole when trimming', async () => {
    const part = await buildExtractionFilePart({
      data: await pdfWithPages(2),
      contentType: 'application/pdf',
      kind: 'anthropic',
      mode: 'trimmed',
    });
    const trimmed = await PDFDocument.load(part?.data as Buffer);
    expect(trimmed.getPageCount()).toBe(2);
  });

  it('returns null for a PDF on a provider without PDF file-part support', async () => {
    const part = await buildExtractionFilePart({
      data: await pdfWithPages(1),
      contentType: 'application/pdf',
      kind: 'mistral',
      mode: 'full',
    });
    expect(part).toBeNull();
  });

  it('returns null instead of failing the job when a PDF cannot be parsed for trimming', async () => {
    const part = await buildExtractionFilePart({
      data: Buffer.from('%PDF-1.4 not really a pdf'),
      contentType: 'application/pdf',
      kind: 'anthropic',
      mode: 'trimmed',
    });
    expect(part).toBeNull();
  });

  it('returns null for media types extraction cannot attach (e.g. office documents)', async () => {
    const part = await buildExtractionFilePart({
      data: Buffer.from('DOCX'),
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      kind: 'anthropic',
      mode: 'full',
    });
    expect(part).toBeNull();
  });
});
