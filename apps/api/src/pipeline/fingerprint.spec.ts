import { describe, expect, it } from 'vitest';
import { configFingerprint, contentHash, tagHintsDigest } from './fingerprint';

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

  it('encodes extraction as "llm:off" when no LLM model is given (OCR-only mode)', () => {
    const ocr = { kind: 'mistral', model: 'mistral-ocr-latest' };
    expect(configFingerprint({ llm: null, ocr })).toContain('llm:off');
  });

  it('pins the exact byte format — a silent format change would mass-reprocess every install', () => {
    expect(configFingerprint({ llm, ocr: null })).toBe('v1|llm:anthropic/claude-haiku-4-5|ocr:off');
    expect(configFingerprint({ llm, ocr: { kind: 'mistral', model: 'mistral-ocr-latest' } })).toBe(
      'v1|llm:anthropic/claude-haiku-4-5|ocr:mistral/mistral-ocr-latest',
    );
    expect(
      configFingerprint({ llm: null, ocr: { kind: 'mistral', model: 'mistral-ocr-latest' } }),
    ).toBe('v1|llm:off|ocr:mistral/mistral-ocr-latest');
  });

  it('differs between extraction off and on (toggling extraction reprocesses)', () => {
    const ocr = { kind: 'mistral', model: 'mistral-ocr-latest' };
    expect(configFingerprint({ llm: null, ocr })).not.toBe(configFingerprint({ llm, ocr }));
  });

  it('stays on the historical format while no tag hints exist', () => {
    expect(configFingerprint({ llm, hintsDigest: null })).toBe(configFingerprint({ llm }));
    expect(configFingerprint({ llm })).not.toContain('hints:');
  });

  it('changes when a hint appears or changes (editing a hint reprocesses on re-tag)', () => {
    const none = configFingerprint({ llm });
    const a = configFingerprint({ llm, hintsDigest: tagHintsDigest(new Map([[1, 'bills']])) });
    const b = configFingerprint({ llm, hintsDigest: tagHintsDigest(new Map([[1, 'invoices']])) });
    expect(a).not.toBe(none);
    expect(a).not.toBe(b);
  });
});

describe('tagHintsDigest', () => {
  it('is null with no hints and insensitive to map insertion order', () => {
    expect(tagHintsDigest(new Map())).toBeNull();
    const ab = tagHintsDigest(
      new Map([
        [1, 'a'],
        [2, 'b'],
      ]),
    );
    const ba = tagHintsDigest(
      new Map([
        [2, 'b'],
        [1, 'a'],
      ]),
    );
    expect(ab).toBe(ba);
    expect(ab).toMatch(/^[0-9a-f]{16}$/);
  });

  it('distinguishes which tag carries which hint', () => {
    expect(
      tagHintsDigest(
        new Map([
          [1, 'a'],
          [2, 'b'],
        ]),
      ),
    ).not.toBe(
      tagHintsDigest(
        new Map([
          [1, 'b'],
          [2, 'a'],
        ]),
      ),
    );
  });
});
