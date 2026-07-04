import { PROMPT_KEY, type PromptKey } from './const';

/** A `{{name}}` placeholder the user can drop into a prompt body. */
export interface PromptVariable {
  /** The token name, used as `{{name}}`. */
  name: string;
  /** Short human label for the insert button. */
  label: string;
  /** What the value expands to at run time. */
  description: string;
}

/** Display metadata for the prompt list + editor header. */
export interface PromptMeta {
  label: string;
  description: string;
}

export const PROMPT_META: Record<PromptKey, PromptMeta> = {
  [PROMPT_KEY.EXTRACTION]: {
    label: 'Metadata extraction',
    description:
      'Asks the model for the title, tags, correspondent and date. The response shape is enforced separately, so this prompt is about guidance and which context to include.',
  },
  [PROMPT_KEY.OCR]: {
    label: 'OCR transcription',
    description:
      'Instructions for the vision model that reads a document’s original file into text. Used when OCR is enabled and the OCR model is a vision LLM (the dedicated Mistral OCR endpoint ignores it).',
  },
};

/**
 * The variables each prompt can reference. Anything not listed here is left
 * untouched (so a typo stays visible rather than silently vanishing). `{{content}}`
 * is the OCR/extraction input text and so is only meaningful for extraction —
 * OCR *produces* that text.
 */
export const PROMPT_VARIABLES: Record<PromptKey, PromptVariable[]> = {
  [PROMPT_KEY.EXTRACTION]: [
    { name: 'content', label: 'Document text', description: 'The recognised text (OCR output, or paperless’s existing text).' },
    { name: 'language', label: 'Language', description: 'The configured output language, or “auto”.' },
    { name: 'all_tags', label: 'Existing tags', description: 'Every tag already in paperless — encourages reuse over invention. When any tag has a hint (Tags page), hinted tags render as a Markdown table of tag → hint, the rest as a list below it.' },
    { name: 'all_correspondents', label: 'Existing correspondents', description: 'Every correspondent already in paperless.' },
    { name: 'tag_policy', label: 'Tag policy', description: 'A sentence stating whether the model may introduce new tags (reflects the “Create new tags” setting).' },
    { name: 'correspondent_policy', label: 'Correspondent policy', description: 'A sentence stating whether the model may introduce a new correspondent (reflects the “Create new correspondents” setting).' },
    { name: 'title', label: 'Current title', description: 'The document’s current title in paperless.' },
    { name: 'tags', label: 'Current tags', description: 'The document’s current tag names.' },
    { name: 'correspondent', label: 'Current correspondent', description: 'The document’s current correspondent, if any.' },
    { name: 'created', label: 'Current date', description: 'The document’s current date (YYYY-MM-DD).' },
    { name: 'filename', label: 'File name', description: 'The document’s original file name.' },
  ],
  [PROMPT_KEY.OCR]: [
    { name: 'language', label: 'Language', description: 'The configured output language, or “auto”.' },
    { name: 'filename', label: 'File name', description: 'The document’s original file name.' },
  ],
};

/**
 * Built-in default bodies. These live in code (not the database): the DB stores
 * only a user's override, so "Reset to default" is just dropping that row and
 * the defaults can keep evolving with the app.
 */
export const DEFAULT_PROMPTS: Record<PromptKey, string> = {
  [PROMPT_KEY.EXTRACTION]: `You extract structured metadata from a single archived document for a paperless-ngx system.
Return concise, human-meaningful values:
- title: a short descriptive title — no file extensions, no reference numbers as the whole title.
- tags: a few relevant topical tags. Strongly prefer reusing an existing tag listed below when it fits. {{tag_policy}}
- correspondent: the organisation or person the document is from (issuer/sender), or null if not evident. Prefer an existing correspondent when it matches. {{correspondent_policy}}
- date: the document's own date (when it was issued or written) as YYYY-MM-DD, or null if not evident. Never use today's date as a fallback.

Write all output in {{language}} (use the document's own language when this is "auto").

Existing tags: {{all_tags}}
Existing correspondents: {{all_correspondents}}

--- DOCUMENT CONTENT ---
{{content}}`,
  [PROMPT_KEY.OCR]: `You are a precise OCR engine. Transcribe the attached document exactly as written.
Output ONLY the document text — no preamble, no commentary, no code fences.
Preserve the reading order, line breaks and structure. Render tables as simple Markdown tables.
Do not translate, summarise, correct spelling, or invent content. Mark an unreadable run as [illegible].
Document language hint: {{language}}.`,
};
