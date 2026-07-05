import { describe, expect, it } from 'vitest';
import { MAX_CONTENT_CHARS, extractionVars, ocrVars, renderTemplate } from './render';

describe('renderTemplate', () => {
  it('substitutes known variables and tolerates whitespace in the braces', () => {
    const out = renderTemplate('Hi {{name}} / {{ name }}', { name: 'ACME' });
    expect(out).toBe('Hi ACME / ACME');
  });

  it('leaves an unknown placeholder untouched so a typo stays visible', () => {
    expect(renderTemplate('a {{nope}} b', { name: 'x' })).toBe('a {{nope}} b');
  });
});

describe('extractionVars', () => {
  const base = {
    content: 'body',
    language: 'auto',
    allTags: [{ name: 'Invoice' }, { name: 'Tax' }],
    allCorrespondents: ['ACME'],
    allowNewTags: true,
    allowNewCorrespondents: true,
    currentTitle: 'scan_0001',
    currentTags: [],
    currentCorrespondent: null,
    created: null,
    filename: null,
  };

  it('joins lists and falls back to (none) for empties', () => {
    const v = extractionVars(base);
    expect(v.all_tags).toBe('Invoice, Tax');
    expect(v.tags).toBe('(none)');
    expect(v.correspondent).toBe('(none)');
    expect(v.filename).toBe('(none)');
    expect(v.title).toBe('scan_0001');
  });

  it('expands the create-new toggles into directive sentences, independently', () => {
    const allowed = extractionVars({ ...base, allowNewTags: true, allowNewCorrespondents: false });
    expect(allowed.tag_policy).toContain('may introduce a new tag');
    expect(allowed.correspondent_policy).toContain('Do not invent a new correspondent');

    const flipped = extractionVars({ ...base, allowNewTags: false, allowNewCorrespondents: true });
    expect(flipped.tag_policy).toContain('Do not invent new tags');
    expect(flipped.correspondent_policy).toContain('may introduce a new correspondent');
  });

  it('keeps the comma list while no tag carries a hint', () => {
    const v = extractionVars({
      ...base,
      allTags: [
        { name: 'Invoice', comment: null },
        { name: 'Tax', comment: '  ' },
      ],
    });
    expect(v.all_tags).toBe('Invoice, Tax');
    expect(extractionVars({ ...base, allTags: [] }).all_tags).toBe('(none)');
  });

  it('switches to a Markdown table of hinted tags once any tag has a hint', () => {
    const v = extractionVars({
      ...base,
      allTags: [
        { name: 'Invoice', comment: 'Bills we have to pay' },
        { name: 'Tax', comment: null },
        { name: 'Receipts', comment: '' },
      ],
    });
    expect(v.all_tags).toBe(
      '\n| Tag | When to use it |\n| --- | --- |\n| Invoice | Bills we have to pay |\n\nOther existing tags: Tax, Receipts\n',
    );
  });

  it('omits the trailing list when every tag has a hint', () => {
    const v = extractionVars({
      ...base,
      allTags: [{ name: 'Invoice', comment: 'Bills' }],
    });
    expect(v.all_tags).toBe('\n| Tag | When to use it |\n| --- | --- |\n| Invoice | Bills |\n');
  });

  it('contains hint text in its cell but leaves tag names verbatim for echo-matching', () => {
    const v = extractionVars({
      ...base,
      allTags: [{ name: 'A|B', comment: 'line one\nline two, with | pipe' }],
    });
    expect(v.all_tags).toContain('| A|B | line one line two, with \\| pipe |');
  });

  it('stays a detached block when the placeholder sits mid-line', () => {
    const out = renderTemplate(
      'Existing tags: {{all_tags}} — always prefer these.',
      extractionVars({ ...base, allTags: [{ name: 'Tax', comment: 'Tax office mail' }] }),
    );
    expect(out).toContain('| Tax | Tax office mail |\n');
    expect(out).toContain('\n — always prefer these.');
  });

  it('truncates very long content', () => {
    const v = extractionVars({ ...base, content: 'x'.repeat(MAX_CONTENT_CHARS + 500) });
    expect(v.content).toContain('…[truncated]');
    expect(v.content.length).toBeLessThan(MAX_CONTENT_CHARS + 50);
  });

  it('renders a full template end-to-end', () => {
    const out = renderTemplate(
      'Lang: {{language}}\nExisting: {{all_tags}}\n{{content}}',
      extractionVars({ ...base, language: 'Swedish', content: 'Invoice text' }),
    );
    expect(out).toContain('Lang: Swedish');
    expect(out).toContain('Existing: Invoice, Tax');
    expect(out).toContain('Invoice text');
  });
});

describe('ocrVars', () => {
  it('exposes language and filename', () => {
    expect(ocrVars({ language: 'de', filename: 'a.pdf' })).toEqual({
      language: 'de',
      filename: 'a.pdf',
    });
    expect(ocrVars({ language: 'auto', filename: null }).filename).toBe('(none)');
  });
});
