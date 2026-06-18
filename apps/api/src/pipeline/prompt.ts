/** Schema name/description handed to providers that use them as LLM guidance. */
export const EXTRACTION_SCHEMA_NAME = 'document_metadata';
export const EXTRACTION_SCHEMA_DESCRIPTION =
  'Title, tags, correspondent and date extracted from an archived document.';

/** Hard cap on prompt content; M7 will make caps configurable. */
const MAX_CONTENT_CHARS = 16_000;

export interface ExtractionPromptInput {
  content: string;
  /** 'auto' or a language name/code from settings. */
  language: string;
  /** Existing taxonomy to steer reuse over invention. */
  tags: string[];
  correspondents: string[];
}

/**
 * Builds the system + user prompt for the single metadata-extraction call.
 * Built-in for M3; M6 makes these templates editable. The output is constrained
 * separately by the Zod schema passed to `generateObject`.
 */
export function buildExtractionPrompt(input: ExtractionPromptInput): {
  system: string;
  prompt: string;
} {
  const languageLine =
    input.language && input.language !== 'auto'
      ? `Write all output in ${input.language}.`
      : 'Write all output in the same language as the document.';

  const system = [
    'You extract structured metadata from a single archived document for a paperless-ngx system.',
    'Return concise, human-meaningful values:',
    '- title: a short descriptive title — no file extensions, no reference numbers as the whole title.',
    '- tags: a few relevant topical tags. Strongly prefer reusing an existing tag listed below when it fits; only invent a tag when none apply.',
    '- correspondent: the organisation or person the document is from (issuer/sender), or null if not evident. Prefer an existing correspondent when it matches.',
    "- date: the document's own date (when it was issued or written) as YYYY-MM-DD, or null if not evident. Never use today's date as a fallback.",
    languageLine,
  ].join('\n');

  const taxonomy = [
    `Existing tags: ${input.tags.length ? input.tags.join(', ') : '(none yet)'}`,
    `Existing correspondents: ${input.correspondents.length ? input.correspondents.join(', ') : '(none yet)'}`,
  ].join('\n');

  const content =
    input.content.length > MAX_CONTENT_CHARS
      ? `${input.content.slice(0, MAX_CONTENT_CHARS)}\n…[truncated]`
      : input.content;

  return {
    system,
    prompt: `${taxonomy}\n\n--- DOCUMENT CONTENT ---\n${content}`,
  };
}
