import { Injectable, Logger } from '@nestjs/common';
import {
  generateObject,
  generateText,
  JSONParseError,
  NoObjectGeneratedError,
  TypeValidationError,
  type LanguageModel,
} from 'ai';
import type { z } from 'zod';

/**
 * `generateObject` is generic over the schema, and inferring its return type
 * from a runtime `z.ZodType<T>` makes the SDK's `InferSchema` recurse without
 * bound (TS2589). We only ever call it with a Zod schema and read `object` +
 * `usage`, so we view it through this concrete, non-generic signature. The
 * schema is still validated at runtime exactly as before.
 */
type GenerateObjectFn = (opts: {
  model: LanguageModel;
  schema: z.ZodType<unknown>;
  schemaName?: string;
  schemaDescription?: string;
  system?: string;
  prompt: string;
  maxOutputTokens?: number;
  abortSignal?: AbortSignal;
  experimental_repairText?: (o: {
    text: string;
  }) => Promise<string | null>;
}) => Promise<{
  object: unknown;
  usage: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
}>;

const generateObjectFn = generateObject as unknown as GenerateObjectFn;

/** Normalised token usage for cost tracking (provider-agnostic). */
export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface GenerateStructuredArgs<T> {
  model: LanguageModel;
  schema: z.ZodType<T>;
  prompt: string;
  system?: string;
  /** Surfaced to providers that name the output (tool/schema name). */
  schemaName?: string;
  schemaDescription?: string;
  maxOutputTokens?: number;
  abortSignal?: AbortSignal;
}

export interface GenerateStructuredResult<T> {
  object: T;
  usage: LlmUsage;
}

/**
 * Thin wrapper over the Vercel AI SDK's `generateObject`. The SDK enforces the
 * Zod schema where the provider supports structured output; for loose runtimes
 * we add two safety nets:
 *   1. `experimental_repairText` strips code fences / surrounding prose before
 *      JSON parsing (no extra model call).
 *   2. on `NoObjectGeneratedError`, one stricter retry that orders the model to
 *      emit a bare JSON object.
 * Output is always schema-validated by the SDK before it returns.
 */
@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  async generateStructured<T>(
    args: GenerateStructuredArgs<T>,
  ): Promise<GenerateStructuredResult<T>> {
    try {
      return await this.run(args);
    } catch (err) {
      if (!NoObjectGeneratedError.isInstance(err)) throw err;
      // The SDK wraps the real cause: a JSONParseError (bad JSON) or a
      // TypeValidationError (valid JSON, wrong shape). Feed the right hint back
      // — a "no markdown" nudge is useless when the JSON parsed but mis-matched.
      const hint = retryHint(err.cause);
      this.logger.warn(hint.log);
      return this.run({
        ...args,
        system: [args.system, hint.instruction].filter(Boolean).join('\n\n'),
      });
    }
  }

  /** Cheap reachability + auth probe for the "Test" button. Throws on failure. */
  async ping(model: LanguageModel): Promise<void> {
    await generateText({
      model,
      prompt: 'Respond with the single word: OK.',
      maxOutputTokens: 16,
    });
  }

  private async run<T>(
    args: GenerateStructuredArgs<T>,
  ): Promise<GenerateStructuredResult<T>> {
    const result = await generateObjectFn({
      model: args.model,
      schema: args.schema,
      schemaName: args.schemaName,
      schemaDescription: args.schemaDescription,
      system: args.system,
      prompt: args.prompt,
      maxOutputTokens: args.maxOutputTokens,
      abortSignal: args.abortSignal,
      experimental_repairText: repairJsonText,
    });
    return { object: result.object as T, usage: normaliseUsage(result.usage) };
  }
}

/** Coalesce the SDK's `number | undefined` token counts into a stable shape. */
export function normaliseUsage(usage: {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}): LlmUsage {
  const inputTokens = usage.inputTokens ?? 0;
  const outputTokens = usage.outputTokens ?? 0;
  return {
    inputTokens,
    outputTokens,
    totalTokens: usage.totalTokens ?? inputTokens + outputTokens,
  };
}

/**
 * Extract the first balanced `{ … }` object, dropping code fences / prose
 * around it. A brace-depth scan (ignoring braces inside string literals) beats
 * `lastIndexOf('}')`, which would swallow trailing prose containing a `}`.
 */
function repairJsonText({ text }: { text: string }): Promise<string | null> {
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  const start = cleaned.indexOf('{');
  if (start === -1) return Promise.resolve(null);

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) {
      return Promise.resolve(cleaned.slice(start, i + 1));
    }
  }
  return Promise.resolve(null);
}

/** The stricter-retry instruction + log line, tailored to why parsing failed. */
function retryHint(cause: unknown): { log: string; instruction: string } {
  if (TypeValidationError.isInstance(cause)) {
    return {
      log: 'structured output failed schema validation; retrying with the validation detail',
      instruction:
        'Your previous response was valid JSON but did not match the required schema. ' +
        `Fix these problems and respond with ONLY a single matching JSON object: ${cause.message}`,
    };
  }
  if (JSONParseError.isInstance(cause)) {
    return {
      log: 'structured output was not valid JSON; retrying with a stricter instruction',
      instruction:
        'Your previous response was not valid JSON. Respond with ONLY a single JSON object ' +
        'that matches the schema — no prose, no markdown, no code fences.',
    };
  }
  return {
    log: 'structured output unparseable; retrying with a stricter instruction',
    instruction:
      'Your previous response could not be parsed. Respond with ONLY a single JSON object ' +
      'that matches the schema — no prose, no markdown, no code fences.',
  };
}
