import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq, or } from 'drizzle-orm';
import {
  CLOUD_PROVIDER_KINDS,
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
} from '@paperless-starfruit/shared';
import { DB } from '../db/db.module';
import type { Db } from '../db/client';
import { provider, settings, type Provider } from '../db/schema';
import { CryptoService } from '../crypto/crypto.service';
import { LlmService } from './llm.service';
import { buildLanguageModel, defaultCaps, type ResolvedCredential } from './model.factory';

/** Vendors (by `owned_by`) the app has a provider kind for. */
const SUPPORTED_VENDORS = new Set<string>(CLOUD_PROVIDER_KINDS);

/** Shape of a model entry from the Vercel AI Gateway `/v1/models` response. */
interface GatewayModel {
  id: string;
  name?: string;
  owned_by?: string;
  type?: string;
  tags?: string[];
  pricing?: { input?: string; output?: string };
}

/** Parse the gateway's per-token price strings; null unless both are present. */
function parsePricing(p?: { input?: string; output?: string }): ModelInfo['pricing'] {
  const input = Number(p?.input);
  const output = Number(p?.output);
  return p && Number.isFinite(input) && Number.isFinite(output) ? { input, output } : null;
}

/**
 * Owns provider credentials (API keys / local endpoints) with the key encrypted
 * at rest and never returned to the client. The bound model is gone (model
 * choice lives in settings), so this also discovers which models each credential
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

  /** Models offered by every configured credential, split into API vs local,
   *  plus the full supported-vendor catalog for previewing unconnected providers. */
  async listAvailableModels(): Promise<AvailableModels> {
    const creds = this.db.select().from(provider).orderBy(provider.id).all();
    const catalog = await this.gatewayCatalog();
    const api: ProviderModels[] = [];
    const local: ProviderModels[] = [];

    for (const c of creds) {
      const kind = c.kind as ProviderKind;
      const meta = PROVIDER_KIND_META[kind];
      if (meta?.local) {
        local.push(await this.localModels(c, kind));
      } else {
        const models = catalog[kind] ?? [];
        api.push({ providerId: c.id, providerName: c.name, kind, manual: false, models });
      }
    }
    return { api, local, catalog };
  }

  /**
   * Live model list for the supported cloud vendors, sourced from the Vercel AI
   * Gateway and cached in memory. Intelligence is a placeholder (0) until a
   * dedicated ratings source is wired in. Falls back to the bundled catalog when
   * the gateway is unreachable so the picker keeps working offline.
   */
  private async gatewayCatalog(): Promise<Record<string, ModelInfo[]>> {
    const TTL = 6 * 60 * 60 * 1000;
    if (this.gatewayCache && Date.now() - this.gatewayCache.at < TTL) {
      return this.gatewayCache.catalog;
    }
    try {
      const res = await fetch('https://ai-gateway.vercel.sh/v1/models');
      if (!res.ok) throw new Error(`Gateway models endpoint responded ${res.status}.`);
      const json = (await res.json()) as { data?: GatewayModel[] };
      const catalog: Record<string, ModelInfo[]> = {};
      for (const m of json.data ?? []) {
        // Only chat models from vendors we have a provider kind for.
        if (m.type !== 'language' || !m.owned_by || !SUPPORTED_VENDORS.has(m.owned_by)) continue;
        const id = m.id.includes('/') ? m.id.slice(m.id.indexOf('/') + 1) : m.id;
        (catalog[m.owned_by] ??= []).push({
          id,
          label: m.name || id,
          vision: m.tags?.includes('vision') ?? false,
          intelligence: 0,
          pricing: parsePricing(m.pricing),
        });
      }
      this.gatewayCache = { at: Date.now(), catalog };
      return catalog;
    } catch {
      const fallback: Record<string, ModelInfo[]> = {};
      for (const kind of Object.keys(MODEL_CATALOG) as ProviderKind[]) {
        if (PROVIDER_KIND_META[kind].local || MODEL_CATALOG[kind].length === 0) continue;
        fallback[kind] = MODEL_CATALOG[kind].map((m) => ({
          id: m.id,
          label: m.label,
          vision: m.vision,
          intelligence: 0,
          pricing: null,
        }));
      }
      return fallback;
    }
  }
  private gatewayCache: { at: number; catalog: Record<string, ModelInfo[]> } | null = null;

  private async localModels(c: Provider, kind: ProviderKind): Promise<ProviderModels> {
    const base = { providerId: c.id, providerName: c.name, kind };
    if (!c.baseUrl) return { ...base, manual: true, models: [] };
    try {
      const models = await this.fetchLocalModels(c.baseUrl, this.crypto.decrypt(c.apiKeyEncrypted));
      return { ...base, manual: false, models };
    } catch {
      // Endpoint unreachable; let the UI fall back to a manual model id.
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
    return (
      (json.data ?? [])
        .map((d) => d.id)
        .filter((id): id is string => !!id)
        // Local model vision support is unknown; assume capable (user's own model).
        // Intelligence and pricing aren't knowable for arbitrary local models.
        .map((id) => ({ id, label: id, vision: true, intelligence: null, pricing: null }))
    );
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

/** Map a DB row to the client-facing config; the encrypted key is dropped. */
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
