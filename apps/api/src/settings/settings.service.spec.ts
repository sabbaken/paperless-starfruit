import { describe, expect, it } from 'vitest';
import { createTestDb } from '../../test/db';
import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  it('creates the row with column defaults on first read', () => {
    const svc = new SettingsService(createTestDb());
    expect(svc.get()).toEqual({
      pollIntervalSec: 60,
      autoApply: false,
      createNewTags: true,
      language: 'auto',
      ocrEnabled: false,
      correspondentBlacklist: [],
      llmProviderId: null,
      llmModel: null,
      ocrProviderId: null,
      ocrModel: null,
    });
  });

  it('persists a partial update and leaves other fields untouched', () => {
    const svc = new SettingsService(createTestDb());
    const updated = svc.update({ autoApply: true, llmProviderId: 3, llmModel: 'claude-haiku-4-5' });
    expect(updated.autoApply).toBe(true);
    expect(updated.llmProviderId).toBe(3);
    expect(updated.llmModel).toBe('claude-haiku-4-5');
    expect(updated.createNewTags).toBe(true);
    // re-read sees the same persisted state
    expect(svc.get().autoApply).toBe(true);
  });

  it('treats an empty patch as a no-op', () => {
    const svc = new SettingsService(createTestDb());
    svc.update({ language: 'de' });
    expect(svc.update({}).language).toBe('de');
  });
});
