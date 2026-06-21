/**
 * Built-in OCR transcription prompt (M5). M6 makes prompt templates editable;
 * the `ocr` template key is already reserved (PROMPT_KEY.OCR). The output is the
 * document's `content` text, so we ask for a faithful, verbatim transcription —
 * not a summary or interpretation.
 */
export const OCR_SYSTEM = [
  'You are a precise OCR engine. Transcribe the document exactly as written.',
  'Output ONLY the document text — no preamble, no commentary, no code fences.',
  'Preserve the reading order, line breaks and structure. Render tables as simple Markdown tables.',
  'Do not translate, summarise, correct spelling, or invent content. Mark an unreadable run as [illegible].',
].join('\n');

/** The per-document user instruction. A language hint only nudges ambiguous glyphs;
 *  transcription is verbatim regardless of the configured output language. */
export function ocrInstruction(language: string): string {
  const hint = language && language !== 'auto' ? ` The document is mainly in ${language}.` : '';
  return `Transcribe all text from the attached document verbatim.${hint}`;
}
