import { describe, expect, it } from 'vitest';
import { PROVIDER_KIND } from '@paperless-ai/shared';
import { buildLanguageModel, defaultCaps, type ResolvedProvider } from './model.factory';

const base = { name: 'p', apiKey: 'sk-test', model: 'some-model' };

function modelId(p: ResolvedProvider): string {
  return (buildLanguageModel(p) as { modelId: string }).modelId;
}

describe('buildLanguageModel', () => {
  it('resolves each first-party provider kind to a model with the right id', () => {
    expect(modelId({ ...base, kind: PROVIDER_KIND.ANTHROPIC })).toBe('some-model');
    expect(modelId({ ...base, kind: PROVIDER_KIND.OPENAI })).toBe('some-model');
    expect(modelId({ ...base, kind: PROVIDER_KIND.GOOGLE })).toBe('some-model');
    expect(modelId({ ...base, kind: PROVIDER_KIND.MISTRAL })).toBe('some-model');
  });

  it('resolves an openai-compatible provider when a baseUrl is given', () => {
    const m = buildLanguageModel({
      ...base,
      kind: PROVIDER_KIND.OPENAI_COMPATIBLE,
      baseUrl: 'http://localhost:11434/v1',
    });
    expect((m as { modelId: string }).modelId).toBe('some-model');
  });

  it('rejects an openai-compatible provider without a baseUrl', () => {
    expect(() =>
      buildLanguageModel({ ...base, kind: PROVIDER_KIND.OPENAI_COMPATIBLE }),
    ).toThrow(/base URL/i);
  });
});

describe('defaultCaps', () => {
  it('bills LLM providers per token', () => {
    for (const kind of Object.values(PROVIDER_KIND)) {
      expect(defaultCaps(kind).billingUnit).toBe('tokens');
    }
  });

  it('treats openai-compatible as the conservative, no-vision default', () => {
    expect(defaultCaps(PROVIDER_KIND.OPENAI_COMPATIBLE).supportsVision).toBe(false);
    expect(defaultCaps(PROVIDER_KIND.ANTHROPIC).supportsVision).toBe(true);
  });
});
