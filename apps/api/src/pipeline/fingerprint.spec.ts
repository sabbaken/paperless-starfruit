import { describe, expect, it } from 'vitest';
import { configFingerprint, contentHash } from './fingerprint';

describe('contentHash', () => {
  const fp = configFingerprint({ providerKind: 'anthropic', model: 'claude-haiku-4-5' });

  it('is deterministic for the same text + config', () => {
    expect(contentHash('hello', fp)).toBe(contentHash('hello', fp));
    expect(contentHash('hello', fp)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes when the text changes', () => {
    expect(contentHash('a', fp)).not.toBe(contentHash('b', fp));
  });

  it('changes when the config fingerprint changes (re-OCR with a different model reprocesses)', () => {
    const other = configFingerprint({ providerKind: 'openai', model: 'gpt-4o-mini' });
    expect(contentHash('same text', fp)).not.toBe(contentHash('same text', other));
  });
});
