import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq, or } from 'drizzle-orm';
import {
  defaultModelFor,
  MODEL_CATALOG,
  PROVIDER_KIND_META,
  providerCapsSchema,
  type AvailableModels,
  type ModelInfo,
  type ProviderConfig,
  type ProviderInput,
  type ProviderKind,
  type ProviderModels,
  type ProviderTestInput,
  type ProviderTestResult,
  type ProviderUpdate,
} from '@paperless-ai/shared';
import { DB } from '../db/db.module';
import type { Db } from '../db/client';
import { provider, settings, type Provider } from '../db/schema';
import { CryptoService } from '../crypto/crypto.service';
import { LlmService } from './llm.service';
import {
  buildLanguageModel,
  defaultCaps,
  type ResolvedCredential,
} from './model.factory';

/**
 * Owns provider credentials (API keys / local endpoints) with the key encrypted
 * at rest and never returned to the client. The bound model is gone — model
 * choice lives in settings — so this also discovers which models each credential
 * offers: the curated catalog for cloud kinds, a live `/models` probe for local.
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
        apiKeyEncrypted: this.crypto.encrypt(input.apiKey ?? ''),
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
    // Don't leave a task pointing at a credential that no longer exists.
    this.clearReferences(id);
  }

  /** Probe a candidate (with `apiKey`) or a saved credential (by `id`). */
  async test(input: ProviderTestInput): Promise<ProviderTestResult> {
    let cred: ResolvedCredential;
    try {
      cred = this.resolveFromInput(input);
    } catch (err) {
      return { ok: false, error: describeError(err) };
    }

    const startedAt = Date.now();
    try {
      if (PROVIDER_KIND_META[cred.kind].local) {
        if (!cred.baseUrl) throw new Error('A base URL is required for a local endpoint.');
        await this.fetchLocalModels(cred.baseUrl, cred.apiKey);
      } else {
        const model = defaultModelFor(cred.kind);
        if (!model) throw new Error('No known model to test this provider with.');
        await this.llm.ping(buildLanguageModel({ ...cred, model }));
      }
      return { ok: true, latencyMs: Date.now() - startedAt };
    } catch (err) {
      return { ok: false, error: describeError(err) };
    }
  }

  /** Resolve a saved credential (key decrypted) for the pipeline. */
  getCredential(id: number): ResolvedCredential | null {
    const row = this.db.select().from(provider).where(eq(provider.id, id)).all()[0];
    if (!row) return null;
    return {
      name: row.name,
      kind: row.kind as ProviderKind,
      apiKey: this.crypto.decrypt(row.apiKeyEncrypted),
      baseUrl: row.baseUrl,
    };
  }

  /** Models offered by every configured credential, split into API vs local. */
  async listAvailableModels(): Promise<AvailableModels> {
    const creds = this.db.select().from(provider).orderBy(provider.id).all();
    const api: ProviderModels[] = [];
    const local: ProviderModels[] = [];

    for (const c of creds) {
      const kind = c.kind as ProviderKind;
      const meta = PROVIDER_KIND_META[kind];
      if (meta?.local) {
        local.push(await this.localModels(c, kind));
      } else {
        const models: ModelInfo[] = (MODEL_CATALOG[kind] ?? []).map((m) => ({
          id: m.id,
          label: m.label,
          vision: m.vision,
          intelligence: m.intelligence,
        }));
        api.push({ providerId: c.id, providerName: c.name, kind, manual: false, models });
      }
    }
    return { api, local };
  }

  private async localModels(c: Provider, kind: ProviderKind): Promise<ProviderModels> {
    const base = { providerId: c.id, providerName: c.name, kind };
    if (!c.baseUrl) return { ...base, manual: true, models: [] };
    try {
      const models = await this.fetchLocalModels(c.baseUrl, this.crypto.decrypt(c.apiKeyEncrypted));
      return { ...base, manual: false, models };
    } catch {
      // Endpoint unreachable — let the UI fall back to a manual model id.
      return { ...base, manual: true, models: [] };
    }
  }

  /** List an OpenAI-compatible endpoint's models (`GET {baseUrl}/models`). */
  private async fetchLocalModels(baseUrl: string, apiKey: string): Promise<ModelInfo[]> {
    const url = `${baseUrl.replace(/\/+$/, '')}/models`;
    const headers: Record<string, string> = {};
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Models endpoint responded ${res.status}.`);
    const json = (await res.json()) as { data?: { id?: string }[] };
    return (json.data ?? [])
      .map((d) => d.id)
      .filter((id): id is string => !!id)
      // Local model vision support is unknown; assume capable (user's own model).
      // Intelligence isn't knowable for arbitrary local models.
      .map((id) => ({ id, label: id, vision: true, intelligence: null }));
  }

  private resolveFromInput(input: ProviderTestInput): ResolvedCredential {
    const apiKey =
      input.apiKey ||
      (input.id != null ? this.crypto.decrypt(this.requireRow(input.id).apiKeyEncrypted) : '');
    if (PROVIDER_KIND_META[input.kind].keyRequired && !apiKey) {
      throw new Error('Provide an API key (or save the credential first) to test it.');
    }
    return { name: input.name, kind: input.kind, apiKey, baseUrl: input.baseUrl ?? null };
  }

  private clearReferences(id: number): void {
    const row = this.db.select().from(settings).where(eq(settings.id, 1)).all()[0];
    if (!row) return;
    this.db
      .update(settings)
      .set({
        ...(row.llmProviderId === id ? { llmProviderId: null, llmModel: null } : {}),
        ...(row.ocrProviderId === id ? { ocrProviderId: null, ocrModel: null } : {}),
      })
      .where(or(eq(settings.llmProviderId, id), eq(settings.ocrProviderId, id)))
      .run();
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
    kind: row.kind as ProviderKind,
    baseUrl: row.baseUrl ?? undefined,
    caps: caps.success ? caps.data : defaultCaps(row.kind as ProviderKind),
  };
}

function describeError(err: unknown): string {
  if (err instanceof Error) {
    // AI SDK / fetch errors carry useful messages (401, model-not-found, bad baseURL…).
    return err.message;
  }
  return 'Unknown error while contacting the provider.';
}
