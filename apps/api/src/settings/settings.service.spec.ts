import { describe, expect, it } from 'vitest';
import { createTestDb } from '../../test/db';
import { provider } from '../db/schema';
import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  it('creates the row with column defaults on first read', () => {
    const svc = new SettingsService(createTestDb());
    expect(svc.get()).toEqual({
      pollIntervalSec: 60,
      autoApply: true,
      createNewTags: false,
      createNewCorrespondents: true,
      extractionEnabled: true,
      extractMaxPages: 100,
      language: 'auto',
      ocrEnabled: true,
      ocrMaxPages: 20,
      correspondentBlacklist: [],
      llmProviderId: null,
      llmModel: null,
      ocrProviderId: null,
      ocrModel: null,
      checkForUpdates: true,
    });
  });

  it('persists a partial update and leaves other fields untouched', () => {
    const db = createTestDb();
    db.insert(provider)
      .values({ id: 3, name: 'p', kind: 'anthropic', apiKeyEncrypted: 'enc' })
      .run();
    const svc = new SettingsService(db);
    const updated = svc.update({ autoApply: true, llmProviderId: 3, llmModel: 'claude-haiku-4-5' });
    expect(updated.autoApply).toBe(true);
    expect(updated.llmProviderId).toBe(3);
    expect(updated.llmModel).toBe('claude-haiku-4-5');
    // createNewTags wasn't in the patch, so it keeps its column default (off)
    expect(updated.createNewTags).toBe(false);
    expect(updated.createNewCorrespondents).toBe(true);
    // re-read sees the same persisted state
    expect(svc.get().autoApply).toBe(true);
  });

  it('coerces a model whose provider credential does not exist to null', () => {
    const svc = new SettingsService(createTestDb());
    const updated = svc.update({ llmProviderId: 99, llmModel: 'claude-haiku-4-5' });
    expect(updated.llmProviderId).toBeNull();
    expect(updated.llmModel).toBeNull();
  });

  it('round-trips the page limits and clears them with null', () => {
    const svc = new SettingsService(createTestDb());
    expect(svc.update({ ocrMaxPages: 10, extractMaxPages: 50 })).toMatchObject({
      ocrMaxPages: 10,
      extractMaxPages: 50,
    });
    expect(svc.get().ocrMaxPages).toBe(10);
    // null clears a previously-set limit
    expect(svc.update({ ocrMaxPages: null }).ocrMaxPages).toBeNull();
    expect(svc.get().extractMaxPages).toBe(50);
  });

  it('treats an empty patch as a no-op', () => {
    const svc = new SettingsService(createTestDb());
    svc.update({ language: 'de' });
    expect(svc.update({}).language).toBe('de');
  });
});
