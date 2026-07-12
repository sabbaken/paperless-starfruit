import { describe, expect, it } from 'vitest';
import { PROVIDER_KIND } from '@paperless-starfruit/shared';
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

  it('normalises dotted Anthropic ids from the gateway catalog to native dashes', () => {
    // The gateway lists `claude-sonnet-4.6`; Anthropic's API wants `claude-sonnet-4-6`.
    expect(modelId({ ...base, kind: PROVIDER_KIND.ANTHROPIC, model: 'claude-sonnet-4.6' })).toBe(
      'claude-sonnet-4-6',
    );
    expect(modelId({ ...base, kind: PROVIDER_KIND.ANTHROPIC, model: 'claude-haiku-4.5' })).toBe(
      'claude-haiku-4-5',
    );
    // Already-native ids are unchanged (idempotent, no dots to convert).
    expect(modelId({ ...base, kind: PROVIDER_KIND.ANTHROPIC, model: 'claude-haiku-4-5' })).toBe(
      'claude-haiku-4-5',
    );
  });

  it('leaves dotted ids untouched for providers whose API uses dots natively', () => {
    // OpenAI/Google/Mistral native ids keep dots (gpt-4.1, gemini-2.5-pro).
    expect(modelId({ ...base, kind: PROVIDER_KIND.OPENAI, model: 'gpt-4.1' })).toBe('gpt-4.1');
    expect(modelId({ ...base, kind: PROVIDER_KIND.GOOGLE, model: 'gemini-2.5-pro' })).toBe(
      'gemini-2.5-pro',
    );
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
    expect(() => buildLanguageModel({ ...base, kind: PROVIDER_KIND.OPENAI_COMPATIBLE })).toThrow(
      /base URL/i,
    );
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
