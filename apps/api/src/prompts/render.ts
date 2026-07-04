/**
 * Prompt rendering: substitute `{{name}}` placeholders with the values the
 * pipeline (or a test run) builds for a document. Unknown placeholders are left
 * untouched so a typo stays visible instead of silently disappearing.
 */

/** Hard cap on the `{{content}}` value; M7 will make caps configurable. */
export const MAX_CONTENT_CHARS = 16_000;

export function renderTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? vars[name] : match,
  );
}

/** One existing tag offered to the model, with the user's optional usage hint. */
export interface TagContext {
  name: string;
  comment?: string | null;
}

export interface ExtractionVarInput {
  /** Recognised text (new OCR output, or paperless's existing text). */
  content: string;
  language: string;
  /** Existing taxonomy, to steer reuse over invention. */
  allTags: TagContext[];
  allCorrespondents: string[];
  /** Whether the model may introduce new tags / correspondents (drives `{{tag_policy}}` / `{{correspondent_policy}}`). */
  allowNewTags: boolean;
  allowNewCorrespondents: boolean;
  /** The document's current metadata in paperless. */
  currentTitle: string;
  currentTags: string[];
  currentCorrespondent: string | null;
  created: string | null;
  filename: string | null;
}

/** Directive sentences the create-new toggles expand to inside the extraction prompt. */
const TAG_POLICY = {
  on: 'If none fits, you may introduce a new tag.',
  off: 'Do not invent new tags — if none fits, use no tag rather than creating one.',
};
const CORRESPONDENT_POLICY = {
  on: 'If none matches, you may introduce a new correspondent.',
  off: 'Do not invent a new correspondent — if none matches, return null.',
};

export function extractionVars(i: ExtractionVarInput): Record<string, string> {
  return {
    content: truncateContent(i.content),
    language: i.language,
    all_tags: tagList(i.allTags),
    all_correspondents: list(i.allCorrespondents),
    tag_policy: i.allowNewTags ? TAG_POLICY.on : TAG_POLICY.off,
    correspondent_policy: i.allowNewCorrespondents ? CORRESPONDENT_POLICY.on : CORRESPONDENT_POLICY.off,
    title: i.currentTitle,
    tags: list(i.currentTags),
    correspondent: orNone(i.currentCorrespondent),
    created: orNone(i.created),
    filename: orNone(i.filename),
  };
}

export interface OcrVarInput {
  language: string;
  filename: string | null;
}

export function ocrVars(i: OcrVarInput): Record<string, string> {
  return { language: i.language, filename: orNone(i.filename) };
}

function truncateContent(text: string): string {
  return text.length > MAX_CONTENT_CHARS
    ? `${text.slice(0, MAX_CONTENT_CHARS)}\n…[truncated]`
    : text;
}

function list(values: string[]): string {
  return values.length ? values.join(', ') : '(none)';
}

/**
 * The `{{all_tags}}` value. Plain comma list while no tag carries a hint (the
 * historical format); as soon as one does, a Markdown table of the *hinted*
 * tags with the rest as a compact list below — hints stay next to their tag
 * without a table row per unhinted tag bloating the prompt. Wrapped in
 * newlines so the block stays intact when the placeholder sits mid-line
 * ("Existing tags: {{all_tags}} — prefer these.").
 */
function tagList(tags: TagContext[]): string {
  if (!tags.length) return '(none)';
  const hinted = tags.filter((t) => t.comment?.trim());
  if (!hinted.length) return list(tags.map((t) => t.name));

  // Tag names go in verbatim (no escaping): the model is asked to echo them
  // back, and an escaped name would no longer match on reconciliation.
  const rows = hinted.map((t) => `| ${t.name} | ${hintCell(t.comment ?? '')} |`);
  const lines = ['', '| Tag | When to use it |', '| --- | --- |', ...rows];
  const plain = tags.filter((t) => !t.comment?.trim());
  if (plain.length) lines.push('', `Other existing tags: ${list(plain.map((t) => t.name))}`);
  lines.push('');
  return lines.join('\n');
}

/** Keep a hint from breaking out of its Markdown table cell. */
function hintCell(value: string): string {
  return value.trim().replace(/\s*\n\s*/g, ' ').replace(/\|/g, '\\|');
}

function orNone(value: string | null): string {
  return value && value.trim() ? value : '(none)';
}
