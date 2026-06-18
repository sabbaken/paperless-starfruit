import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PaperlessClient } from '../paperless/paperless.client';
import { TaxonomyService } from './taxonomy.service';

function fakeClient(
  tags: { id: number; name: string }[] = [],
  correspondents: { id: number; name: string }[] = [],
) {
  let tagSeq = 1000;
  let corrSeq = 2000;
  return {
    listTags: vi.fn().mockResolvedValue(tags),
    listCorrespondents: vi.fn().mockResolvedValue(correspondents),
    createTag: vi.fn((name: string) => Promise.resolve({ id: ++tagSeq, name })),
    createCorrespondent: vi.fn((name: string) => Promise.resolve({ id: ++corrSeq, name })),
  } as unknown as PaperlessClient & {
    listTags: ReturnType<typeof vi.fn>;
    createTag: ReturnType<typeof vi.fn>;
    createCorrespondent: ReturnType<typeof vi.fn>;
  };
}

describe('TaxonomyService', () => {
  let svc: TaxonomyService;
  beforeEach(() => {
    svc = new TaxonomyService();
  });

  it('caches the snapshot within the TTL', async () => {
    const client = fakeClient([{ id: 1, name: 'a' }]);
    await svc.getSnapshot(client);
    await svc.getSnapshot(client);
    expect(client.listTags).toHaveBeenCalledOnce();
  });

  it('resolves existing tags case-insensitively without creating', async () => {
    const client = fakeClient([{ id: 7, name: 'Invoice' }]);
    const resolved = await svc.resolveTags(client, ['invoice'], { create: true });
    expect(resolved).toEqual([{ id: 7, name: 'Invoice', isNew: false }]);
    expect(client.createTag).not.toHaveBeenCalled();
  });

  it('creates missing tags when create=true', async () => {
    const client = fakeClient([]);
    const resolved = await svc.resolveTags(client, ['Receipts'], { create: true });
    expect(resolved[0]).toMatchObject({ name: 'Receipts', isNew: true });
    expect(resolved[0].id).not.toBeNull();
    expect(client.createTag).toHaveBeenCalledWith('Receipts');
  });

  it('defers tag creation (id null) when create=false', async () => {
    const client = fakeClient([]);
    const resolved = await svc.resolveTags(client, ['New Tag'], { create: false });
    expect(resolved).toEqual([{ id: null, name: 'New Tag', isNew: true }]);
    expect(client.createTag).not.toHaveBeenCalled();
  });

  it('de-duplicates suggested tags case-insensitively', async () => {
    const client = fakeClient([]);
    const resolved = await svc.resolveTags(client, ['Tax', 'tax', ' TAX '], { create: false });
    expect(resolved).toHaveLength(1);
  });

  it('drops blacklisted correspondents', async () => {
    const client = fakeClient([], []);
    const out = await svc.resolveCorrespondent(client, 'Spam Co', {
      create: true,
      blacklist: ['spam co'],
    });
    expect(out).toBeNull();
    expect(client.createCorrespondent).not.toHaveBeenCalled();
  });

  it('resolves an existing correspondent', async () => {
    const client = fakeClient([], [{ id: 4, name: 'ACME' }]);
    const out = await svc.resolveCorrespondent(client, 'acme', { create: false, blacklist: [] });
    expect(out).toEqual({ id: 4, name: 'ACME', isNew: false });
  });

  it('resolves and caches the trigger tag ids, creating any that are missing', async () => {
    const client = fakeClient([{ id: 50, name: 'ai-process' }]);
    const first = await svc.resolveTriggerTags(client);
    expect(first.reviewTagId).toBe(50);
    expect(first.autoTagId).not.toBeNull();
    expect(client.createTag).toHaveBeenCalledWith('ai-process-auto');

    client.createTag.mockClear();
    const second = await svc.resolveTriggerTags(client);
    expect(second).toEqual(first);
    expect(client.createTag).not.toHaveBeenCalled();
  });
});
