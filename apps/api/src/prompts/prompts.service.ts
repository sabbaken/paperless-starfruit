import { Inject, Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import {
  DEFAULT_PROMPTS,
  PROMPT_KEY,
  PROMPT_META,
  PROMPT_VARIABLES,
  type PromptConfig,
  type PromptKey,
} from '@paperless-starfruit/shared';
import { DB } from '../db/db.module';
import type { Db } from '../db/client';
import { promptTemplate } from '../db/schema';
import { renderTemplate } from './render';

const PROMPT_KEYS: PromptKey[] = [PROMPT_KEY.EXTRACTION, PROMPT_KEY.OCR];

/**
 * Owns the two editable prompts. The database stores ONLY user overrides (one
 * row per key); a missing row means "use the code default". So "Reset to
 * default" is a plain delete, and the built-in defaults can keep evolving.
 */
@Injectable()
export class PromptsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  list(): PromptConfig[] {
    return PROMPT_KEYS.map((key) => this.toConfig(key));
  }

  get(key: PromptKey): PromptConfig {
    return this.toConfig(key);
  }

  /** The effective body for a run: the override if set, else the default. */
  getBody(key: PromptKey): string {
    return this.override(key)?.body ?? DEFAULT_PROMPTS[key];
  }

  /** Render a prompt with its variables substituted. */
  render(key: PromptKey, vars: Record<string, string>): string {
    return renderTemplate(this.getBody(key), vars);
  }

  update(key: PromptKey, body: string): PromptConfig {
    if (this.override(key)) {
      this.db
        .update(promptTemplate)
        .set({ body, updatedAt: sql`(unixepoch())` })
        .where(eq(promptTemplate.key, key))
        .run();
    } else {
      this.db.insert(promptTemplate).values({ key, body }).run();
    }
    return this.toConfig(key);
  }

  reset(key: PromptKey): PromptConfig {
    this.db.delete(promptTemplate).where(eq(promptTemplate.key, key)).run();
    return this.toConfig(key);
  }

  private toConfig(key: PromptKey): PromptConfig {
    const override = this.override(key);
    const def = DEFAULT_PROMPTS[key];
    return {
      key,
      label: PROMPT_META[key].label,
      description: PROMPT_META[key].description,
      body: override?.body ?? def,
      default: def,
      customized: override != null,
      variables: PROMPT_VARIABLES[key],
    };
  }

  private override(key: PromptKey) {
    return this.db.select().from(promptTemplate).where(eq(promptTemplate.key, key)).all()[0];
  }
}
