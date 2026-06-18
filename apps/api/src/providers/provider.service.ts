import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import {
  providerCapsSchema,
  type ProviderConfig,
  type ProviderInput,
  type ProviderTestInput,
  type ProviderTestResult,
  type ProviderUpdate,
} from '@paperless-ai/shared';
import { DB } from '../db/db.module';
import type { Db } from '../db/client';
import { provider, settings, type Provider } from '../db/schema';
import { CryptoService } from '../crypto/crypto.service';
import { LlmService } from './llm.service';
import { buildLanguageModel, defaultCaps, type ResolvedProvider } from './model.factory';

/**
 * Owns the configured LLM/OCR providers: CRUD with the API key encrypted at
 * rest (never returned to the client), capability derivation, a live "test"
 * probe, and minting a resolved provider for the extraction pipeline.
 */
@Injectable()
export class ProviderService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly crypto: CryptoService,
    private readonly llm: LlmService,
  ) {}

  list(): ProviderConfig[] {
    return this.db.select().from(provider).orderBy(provider.id).all().map(toConfig);
  }

  get(id: number): ProviderConfig {
    return toConfig(this.requireRow(id));
  }

  create(input: ProviderInput): ProviderConfig {
    const [row] = this.db
      .insert(provider)
      .values({
        name: input.name,
        kind: input.kind,
        baseUrl: input.baseUrl ?? null,
        model: input.model,
        apiKeyEncrypted: this.crypto.encrypt(input.apiKey),
        caps: defaultCaps(input.kind),
      })
      .returning()
      .all();
    return toConfig(row);
  }

  update(id: number, input: ProviderUpdate): ProviderConfig {
    this.requireRow(id);
    const [row] = this.db
      .update(provider)
      .set({
        name: input.name,
        kind: input.kind,
        baseUrl: input.baseUrl ?? null,
        model: input.model,
        // A blank key on edit means "keep the stored one".
        ...(input.apiKey ? { apiKeyEncrypted: this.crypto.encrypt(input.apiKey) } : {}),
        caps: defaultCaps(input.kind),
      })
      .where(eq(provider.id, id))
      .returning()
      .all();
    return toConfig(row);
  }

  remove(id: number): void {
    this.requireRow(id);
    this.db.delete(provider).where(eq(provider.id, id)).run();
    // Don't leave the pipeline pointing at a provider that no longer exists.
    this.db
      .update(settings)
      .set({ defaultProviderId: null })
      .where(eq(settings.defaultProviderId, id))
      .run();
  }

  /** Probe a candidate (with `apiKey`) or a saved provider (by `id`). */
  async test(input: ProviderTestInput): Promise<ProviderTestResult> {
    let resolved: ResolvedProvider;
    try {
      resolved = this.resolveFromInput(input);
    } catch (err) {
      return { ok: false, error: describeError(err) };
    }

    const startedAt = Date.now();
    try {
      await this.llm.ping(buildLanguageModel(resolved));
      return { ok: true, latencyMs: Date.now() - startedAt };
    } catch (err) {
      return { ok: false, error: describeError(err) };
    }
  }

  /** Resolve a saved provider (key decrypted) for the extraction pipeline. */
  getResolved(id: number): ResolvedProvider | null {
    const row = this.db.select().from(provider).where(eq(provider.id, id)).all()[0];
    if (!row) return null;
    return {
      name: row.name,
      kind: row.kind as ResolvedProvider['kind'],
      apiKey: this.crypto.decrypt(row.apiKeyEncrypted),
      baseUrl: row.baseUrl,
      model: row.model,
    };
  }

  private resolveFromInput(input: ProviderTestInput): ResolvedProvider {
    const apiKey = input.apiKey
      ? input.apiKey
      : input.id != null
        ? this.crypto.decrypt(this.requireRow(input.id).apiKeyEncrypted)
        : null;
    if (!apiKey) {
      throw new Error('Provide an API key (or save the provider first) to test it.');
    }
    return {
      name: input.name,
      kind: input.kind,
      apiKey,
      baseUrl: input.baseUrl ?? null,
      model: input.model,
    };
  }

  private requireRow(id: number): Provider {
    const row = this.db.select().from(provider).where(eq(provider.id, id)).all()[0];
    if (!row) throw new NotFoundException(`Provider ${id} not found`);
    return row;
  }
}

/** Map a DB row to the client-facing config — the encrypted key is dropped. */
function toConfig(row: Provider): ProviderConfig {
  const caps = providerCapsSchema.safeParse(row.caps);
  return {
    id: row.id,
    name: row.name,
    kind: row.kind as ProviderConfig['kind'],
    baseUrl: row.baseUrl ?? undefined,
    model: row.model,
    caps: caps.success ? caps.data : defaultCaps(row.kind as ProviderConfig['kind']),
  };
}

function describeError(err: unknown): string {
  if (err instanceof Error) {
    // AI SDK errors carry useful messages (401, model-not-found, bad baseURL…).
    return err.message;
  }
  return 'Unknown error while contacting the provider.';
}
