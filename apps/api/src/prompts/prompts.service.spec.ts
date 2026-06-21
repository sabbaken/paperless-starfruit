import { describe, expect, it } from 'vitest';
import { DEFAULT_PROMPTS, PROMPT_KEY } from '@paperless-starfruit/shared';
import { createTestDb } from '../../test/db';
import { PromptsService } from './prompts.service';

describe('PromptsService', () => {
  it('lists both prompts as the built-in defaults until customised', () => {
    const svc = new PromptsService(createTestDb());
    const list = svc.list();
    expect(list.map((p) => p.key).sort()).toEqual(['extraction', 'ocr']);
    for (const p of list) {
      expect(p.customized).toBe(false);
      expect(p.body).toBe(DEFAULT_PROMPTS[p.key]);
      expect(p.body).toBe(p.default);
      expect(p.variables.length).toBeGreaterThan(0);
    }
  });

  it('persists an override, then resets back to the default', () => {
    const svc = new PromptsService(createTestDb());

    const updated = svc.update(PROMPT_KEY.EXTRACTION, 'My custom prompt {{content}}');
    expect(updated.customized).toBe(true);
    expect(updated.body).toBe('My custom prompt {{content}}');
    expect(svc.getBody(PROMPT_KEY.EXTRACTION)).toBe('My custom prompt {{content}}');

    const reset = svc.reset(PROMPT_KEY.EXTRACTION);
    expect(reset.customized).toBe(false);
    expect(reset.body).toBe(DEFAULT_PROMPTS[PROMPT_KEY.EXTRACTION]);
    expect(svc.getBody(PROMPT_KEY.EXTRACTION)).toBe(DEFAULT_PROMPTS[PROMPT_KEY.EXTRACTION]);
  });

  it('updates an existing override in place (one row per key)', () => {
    const svc = new PromptsService(createTestDb());
    svc.update(PROMPT_KEY.OCR, 'first');
    const second = svc.update(PROMPT_KEY.OCR, 'second');
    expect(second.body).toBe('second');
    expect(svc.list().filter((p) => p.key === PROMPT_KEY.OCR)).toHaveLength(1);
  });

  it('renders the active body with variables substituted', () => {
    const svc = new PromptsService(createTestDb());
    svc.update(PROMPT_KEY.EXTRACTION, 'Doc: {{content}} / {{language}}');
    expect(svc.render(PROMPT_KEY.EXTRACTION, { content: 'hello', language: 'de' })).toBe(
      'Doc: hello / de',
    );
  });
});
