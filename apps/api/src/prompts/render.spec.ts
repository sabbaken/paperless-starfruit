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
    allTags: ['Invoice', 'Tax'],
    allCorrespondents: ['ACME'],
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
    expect(ocrVars({ language: 'de', filename: 'a.pdf' })).toEqual({ language: 'de', filename: 'a.pdf' });
    expect(ocrVars({ language: 'auto', filename: null }).filename).toBe('(none)');
  });
});
