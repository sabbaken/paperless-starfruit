import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
// `vi.mock('ai', …)` below is hoisted above this import, so LlmService picks up
// the mocked SDK even though the import is static.
import { LlmService } from './llm.service';

// Mock the AI SDK so no network call happens; `vi.hoisted` makes the spies
// available to the (hoisted) factory below.
const {
  generateObjectMock,
  generateTextMock,
  FakeNoObjectError,
  FakeJSONParseError,
  FakeTypeValidationError,
} = vi.hoisted(() => {
  class FakeNoObjectError extends Error {
    cause?: unknown;
    constructor(message: string, cause?: unknown) {
      super(message);
      this.cause = cause;
    }
    static isInstance(e: unknown): e is FakeNoObjectError {
      return e instanceof FakeNoObjectError;
    }
  }
  class FakeJSONParseError extends Error {
    static isInstance(e: unknown): e is FakeJSONParseError {
      return e instanceof FakeJSONParseError;
    }
  }
  class FakeTypeValidationError extends Error {
    static isInstance(e: unknown): e is FakeTypeValidationError {
      return e instanceof FakeTypeValidationError;
    }
  }
  return {
    generateObjectMock: vi.fn(),
    generateTextMock: vi.fn(),
    FakeNoObjectError,
    FakeJSONParseError,
    FakeTypeValidationError,
  };
});

vi.mock('ai', () => ({
  generateObject: generateObjectMock,
  generateText: generateTextMock,
  NoObjectGeneratedError: FakeNoObjectError,
  JSONParseError: FakeJSONParseError,
  TypeValidationError: FakeTypeValidationError,
}));

const schema = z.object({ title: z.string() });
const model = { modelId: 'fake' } as never;

describe('LlmService.generateStructured', () => {
  beforeEach(() => {
    generateObjectMock.mockReset();
    generateTextMock.mockReset();
  });

  it('returns the validated object and normalised usage', async () => {
    generateObjectMock.mockResolvedValue({
      object: { title: 'Hi' },
      usage: { inputTokens: 10, outputTokens: 4, totalTokens: 14 },
    });

    const out = await new LlmService().generateStructured({ model, schema, prompt: 'p' });

    expect(out.object).toEqual({ title: 'Hi' });
    expect(out.usage).toEqual({ inputTokens: 10, outputTokens: 4, totalTokens: 14 });
  });

  it('derives totalTokens when the provider omits it', async () => {
    generateObjectMock.mockResolvedValue({
      object: { title: 'x' },
      usage: { inputTokens: 3, outputTokens: 5 },
    });

    const out = await new LlmService().generateStructured({ model, schema, prompt: 'p' });
    expect(out.usage.totalTokens).toBe(8);
  });

  it('retries once with a stricter instruction on NoObjectGeneratedError', async () => {
    generateObjectMock
      .mockRejectedValueOnce(new FakeNoObjectError('unparseable'))
      .mockResolvedValueOnce({ object: { title: 'ok' }, usage: {} });

    const out = await new LlmService().generateStructured({
      model,
      schema,
      prompt: 'p',
      system: 'base system',
    });

    expect(out.object).toEqual({ title: 'ok' });
    expect(generateObjectMock).toHaveBeenCalledTimes(2);
    const retrySystem = generateObjectMock.mock.calls[1][0].system as string;
    expect(retrySystem).toContain('base system');
    expect(retrySystem).toMatch(/ONLY a single/i);
  });

  it('feeds the validation detail back when the cause is a schema mismatch', async () => {
    generateObjectMock
      .mockRejectedValueOnce(
        new FakeNoObjectError('no object', new FakeTypeValidationError('title: expected string')),
      )
      .mockResolvedValueOnce({ object: { title: 'ok' }, usage: {} });

    const out = await new LlmService().generateStructured({ model, schema, prompt: 'p' });

    expect(out.object).toEqual({ title: 'ok' });
    const retrySystem = generateObjectMock.mock.calls[1][0].system as string;
    expect(retrySystem).toMatch(/did not match the required schema/i);
    expect(retrySystem).toContain('title: expected string');
  });

  it('does not retry on an unrelated error', async () => {
    generateObjectMock.mockRejectedValue(new Error('429 rate limited'));

    await expect(
      new LlmService().generateStructured({ model, schema, prompt: 'p' }),
    ).rejects.toThrow(/rate limited/);
    expect(generateObjectMock).toHaveBeenCalledTimes(1);
  });
});

describe('LlmService.ping', () => {
  beforeEach(() => generateTextMock.mockReset());

  it('issues a tiny generateText probe', async () => {
    generateTextMock.mockResolvedValue({ text: 'OK' });
    await new LlmService().ping(model);
    expect(generateTextMock).toHaveBeenCalledOnce();
    expect(generateTextMock.mock.calls[0][0].maxOutputTokens).toBeLessThanOrEqual(16);
  });
});
