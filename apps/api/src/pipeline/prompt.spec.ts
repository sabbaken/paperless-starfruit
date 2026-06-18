import { describe, expect, it } from 'vitest';
import { buildExtractionPrompt } from './prompt';

describe('buildExtractionPrompt', () => {
  it('lists the existing taxonomy and includes the content', () => {
    const { system, prompt } = buildExtractionPrompt({
      content: 'Invoice body text',
      language: 'auto',
      tags: ['Invoice', 'Tax'],
      correspondents: ['ACME'],
    });
    expect(prompt).toContain('Existing tags: Invoice, Tax');
    expect(prompt).toContain('Existing correspondents: ACME');
    expect(prompt).toContain('Invoice body text');
    expect(system).toMatch(/same language as the document/i);
  });

  it('pins the output language when one is configured', () => {
    const { system } = buildExtractionPrompt({
      content: 'x',
      language: 'Swedish',
      tags: [],
      correspondents: [],
    });
    expect(system).toContain('Write all output in Swedish.');
  });

  it('truncates very long content', () => {
    const { prompt } = buildExtractionPrompt({
      content: 'x'.repeat(20_000),
      language: 'auto',
      tags: [],
      correspondents: [],
    });
    expect(prompt).toContain('…[truncated]');
    expect(prompt.length).toBeLessThan(20_000);
  });
});
