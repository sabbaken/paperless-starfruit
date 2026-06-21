import { describe, expect, it } from 'vitest';
import { configFingerprint, contentHash } from './fingerprint';

describe('contentHash', () => {
  const fp = configFingerprint({ llm: { kind: 'anthropic', model: 'claude-haiku-4-5' } });

  it('is deterministic for the same text + config', () => {
    expect(contentHash('hello', fp)).toBe(contentHash('hello', fp));
    expect(contentHash('hello', fp)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes when the text changes', () => {
    expect(contentHash('a', fp)).not.toBe(contentHash('b', fp));
  });

  it('changes when the LLM model changes (re-extract with a different model reprocesses)', () => {
    const other = configFingerprint({ llm: { kind: 'openai', model: 'gpt-4o-mini' } });
    expect(contentHash('same text', fp)).not.toBe(contentHash('same text', other));
  });
});

describe('configFingerprint', () => {
  const llm = { kind: 'anthropic', model: 'claude-haiku-4-5' };

  it('encodes OCR as "off" when no OCR model is given', () => {
    expect(configFingerprint({ llm })).toContain('ocr:off');
    expect(configFingerprint({ llm, ocr: null })).toBe(configFingerprint({ llm }));
  });

  it('differs between OCR off and OCR on (toggling OCR reprocesses)', () => {
    const off = configFingerprint({ llm });
    const on = configFingerprint({ llm, ocr: { kind: 'mistral', model: 'mistral-ocr-latest' } });
    expect(off).not.toBe(on);
  });

  it('differs when the OCR provider/model changes (re-OCR with a different provider reprocesses)', () => {
    const a = configFingerprint({ llm, ocr: { kind: 'mistral', model: 'mistral-ocr-latest' } });
    const b = configFingerprint({ llm, ocr: { kind: 'openai', model: 'gpt-4o' } });
    expect(a).not.toBe(b);
  });
});
