import type { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { PROVIDER_KIND } from '@paperless-ai/shared';
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
  model: 'claude-haiku-4-5',
  apiKey: 'sk-secret-123',
};

describe('ProviderService CRUD', () => {
  it('stores the key encrypted and never returns it', () => {
    const { db, service } = makeService();
    const created = service.create(anthropicInput);

    expect(created).toMatchObject({ name: 'Claude', kind: 'anthropic', model: 'claude-haiku-4-5' });
    expect(created).not.toHaveProperty('apiKey');
    expect(created.caps.billingUnit).toBe('tokens');

    const row = db.select().from(provider).where(eq(provider.id, created.id)).all()[0];
    expect(row.apiKeyEncrypted).not.toContain('sk-secret-123');
    expect(row.apiKeyEncrypted.length).toBeGreaterThan(0);
  });

  it('round-trips the decrypted key via getResolved', () => {
    const { service } = makeService();
    const created = service.create(anthropicInput);
    expect(service.getResolved(created.id)?.apiKey).toBe('sk-secret-123');
  });

  it('keeps the stored key when an update omits apiKey', () => {
    const { service } = makeService();
    const created = service.create(anthropicInput);

    service.update(created.id, { name: 'Renamed', kind: PROVIDER_KIND.ANTHROPIC, model: 'claude-sonnet-4-6' });

    expect(service.get(created.id).name).toBe('Renamed');
    expect(service.getResolved(created.id)?.apiKey).toBe('sk-secret-123');
    expect(service.getResolved(created.id)?.model).toBe('claude-sonnet-4-6');
  });

  it('replaces the key when an update provides apiKey', () => {
    const { service } = makeService();
    const created = service.create(anthropicInput);

    service.update(created.id, { ...anthropicInput, apiKey: 'sk-rotated-999' });
    expect(service.getResolved(created.id)?.apiKey).toBe('sk-rotated-999');
  });

  it('clears the pipeline default when its provider is deleted', () => {
    const { db, service } = makeService();
    const created = service.create(anthropicInput);
    db.insert(settings).values({ id: 1, defaultProviderId: created.id }).run();

    service.remove(created.id);

    expect(service.list()).toHaveLength(0);
    const row = db.select().from(settings).where(eq(settings.id, 1)).all()[0];
    expect(row.defaultProviderId).toBeNull();
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
      model: created.model,
    });
    expect(result.ok).toBe(true);
    expect(llm.ping).toHaveBeenCalledOnce();
  });

  it('fails cleanly for openai-compatible without a baseUrl', async () => {
    const { service, llm } = makeService();
    const result = await service.test({
      name: 'local',
      kind: PROVIDER_KIND.OPENAI_COMPATIBLE,
      model: 'llama3',
      apiKey: 'x',
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/base URL/i);
    expect(llm.ping).not.toHaveBeenCalled();
  });
});
