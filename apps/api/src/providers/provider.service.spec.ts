import type { ConfigService } from '@nestjs/config';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { PROVIDER_KIND } from '@paperless-starfruit/shared';
import { createTestDb } from '../../test/db';
import { provider, settings } from '../db/schema';
import { CryptoService } from '../crypto/crypto.service';
import { ProviderService } from './provider.service';
import type { LlmService } from './llm.service';
import type { Db } from '../db/client';

const KEY = Buffer.alloc(32, 7).toString('base64');

function makeService(pingImpl: () => Promise<void> = () => Promise.resolve()) {
  const db: Db = createTestDb();
  const crypto = new CryptoService({ get: () => KEY } as unknown as ConfigService);
  const llm = { ping: vi.fn(pingImpl) } as unknown as LlmService;
  const service = new ProviderService(db, crypto, llm);
  return { db, crypto, llm, service };
}

const anthropicInput = {
  name: 'Claude',
  kind: PROVIDER_KIND.ANTHROPIC,
  apiKey: 'sk-secret-123',
};

describe('ProviderService CRUD', () => {
  it('stores the key encrypted and never returns it', () => {
    const { db, service } = makeService();
    const created = service.create(anthropicInput);

    expect(created).toMatchObject({ name: 'Claude', kind: 'anthropic' });
    expect(created).not.toHaveProperty('apiKey');
    expect(created.caps.billingUnit).toBe('tokens');

    const row = db.select().from(provider).where(eq(provider.id, created.id)).all()[0];
    expect(row.apiKeyEncrypted).not.toContain('sk-secret-123');
    expect(row.apiKeyEncrypted.length).toBeGreaterThan(0);
  });

  it('round-trips the decrypted key via getCredential', () => {
    const { service } = makeService();
    const created = service.create(anthropicInput);
    expect(service.getCredential(created.id)?.apiKey).toBe('sk-secret-123');
  });

  it('keeps the stored key when an update omits apiKey', () => {
    const { service } = makeService();
    const created = service.create(anthropicInput);

    service.update(created.id, { name: 'Renamed', kind: PROVIDER_KIND.ANTHROPIC });

    expect(service.get(created.id).name).toBe('Renamed');
    expect(service.getCredential(created.id)?.apiKey).toBe('sk-secret-123');
  });

  it('replaces the key when an update provides apiKey', () => {
    const { service } = makeService();
    const created = service.create(anthropicInput);

    service.update(created.id, { ...anthropicInput, apiKey: 'sk-rotated-999' });
    expect(service.getCredential(created.id)?.apiKey).toBe('sk-rotated-999');
  });

  it('clears the selected model when its credential is deleted', () => {
    const { db, service } = makeService();
    const created = service.create(anthropicInput);
    db.insert(settings)
      .values({ id: 1, llmProviderId: created.id, llmModel: 'claude-haiku-4-5' })
      .run();

    service.remove(created.id);

    expect(service.list()).toHaveLength(0);
    const row = db.select().from(settings).where(eq(settings.id, 1)).all()[0];
    expect(row.llmProviderId).toBeNull();
    expect(row.llmModel).toBeNull();
  });
});

describe('ProviderService.test', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reports ok with latency when the ping succeeds', async () => {
    const { service } = makeService();
    const result = await service.test({ ...anthropicInput });
    expect(result.ok).toBe(true);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('surfaces the provider error when the ping fails', async () => {
    const { service } = makeService(() => Promise.reject(new Error('401 unauthorized')));
    const result = await service.test({ ...anthropicInput });
    expect(result).toMatchObject({ ok: false });
    expect(result.error).toMatch(/unauthorized/);
  });

  it('uses the stored key when testing a saved provider by id', async () => {
    const { service, llm } = makeService();
    const created = service.create(anthropicInput);

    const result = await service.test({
      id: created.id,
      name: created.name,
      kind: created.kind,
    });
    expect(result.ok).toBe(true);
    expect(llm.ping).toHaveBeenCalledOnce();
  });

  it('fails cleanly for openai-compatible without a baseUrl', async () => {
    const { service, llm } = makeService();
    const result = await service.test({
      name: 'local',
      kind: PROVIDER_KIND.OPENAI_COMPATIBLE,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/base URL/i);
    expect(llm.ping).not.toHaveBeenCalled();
  });

  it('tests a local endpoint by listing its models (no LLM ping)', async () => {
    const { service, llm } = makeService();
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ data: [{ id: 'llama3.1' }] }), { status: 200 }),
        ),
    );
    const result = await service.test({
      name: 'Ollama',
      kind: PROVIDER_KIND.OPENAI_COMPATIBLE,
      baseUrl: 'http://localhost:11434/v1',
    });
    expect(result.ok).toBe(true);
    expect(llm.ping).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

const local = {
  name: 'Ollama',
  kind: PROVIDER_KIND.OPENAI_COMPATIBLE,
  baseUrl: 'http://localhost:11434/v1',
};

describe('ProviderService.listAvailableModels', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns curated catalog models for a cloud credential', async () => {
    const { service } = makeService();
    service.create(anthropicInput);
    const { api, local: localList } = await service.listAvailableModels();
    expect(localList).toHaveLength(0);
    expect(api).toHaveLength(1);
    expect(api[0]).toMatchObject({ kind: 'anthropic', manual: false });
    expect(api[0].models.length).toBeGreaterThan(0);
    expect(api[0].models[0]).toHaveProperty('vision');
  });

  it('discovers a local endpoint’s models live', async () => {
    const { service } = makeService();
    service.create(local);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: [{ id: 'llama3.1' }, { id: 'qwen2.5' }] }), {
          status: 200,
        }),
      ),
    );
    const { api, local: localList } = await service.listAvailableModels();
    expect(api).toHaveLength(0);
    expect(localList).toHaveLength(1);
    expect(localList[0].manual).toBe(false);
    expect(localList[0].models.map((m) => m.id)).toEqual(['llama3.1', 'qwen2.5']);
  });

  it('marks a local endpoint manual when it is unreachable', async () => {
    const { service } = makeService();
    service.create(local);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    const { local: localList } = await service.listAvailableModels();
    expect(localList[0]).toMatchObject({ manual: true });
    expect(localList[0].models).toEqual([]);
  });
});
