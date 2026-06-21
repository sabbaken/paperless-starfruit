import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Settings, SettingsUpdate } from '@paperless-starfruit/shared';
import { DB } from '../db/db.module';
import type { Db } from '../db/client';
import { settings, type SettingsRow } from '../db/schema';

const SETTINGS_ID = 1;

/** Owns the single-row application settings (id = 1), created lazily on first read. */
@Injectable()
export class SettingsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  get(): Settings {
    return toSettings(this.ensureRow());
  }

  update(patch: SettingsUpdate): Settings {
    this.ensureRow();
    if (Object.keys(patch).length > 0) {
      this.db.update(settings).set(patch).where(eq(settings.id, SETTINGS_ID)).run();
    }
    return this.get();
  }

  private ensureRow(): SettingsRow {
    const existing = this.row();
    if (existing) return existing;
    // Column defaults fill everything except the id.
    this.db.insert(settings).values({ id: SETTINGS_ID }).run();
    return this.row()!;
  }

  private row(): SettingsRow | undefined {
    return this.db.select().from(settings).where(eq(settings.id, SETTINGS_ID)).all()[0];
  }
}

function toSettings(row: SettingsRow): Settings {
  return {
    pollIntervalSec: row.pollIntervalSec,
    autoApply: row.autoApply,
    createNewTags: row.createNewTags,
    language: row.language,
    ocrEnabled: row.ocrEnabled,
    correspondentBlacklist: row.correspondentBlacklist,
    llmProviderId: row.llmProviderId ?? null,
    llmModel: row.llmModel ?? null,
    ocrProviderId: row.ocrProviderId ?? null,
    ocrModel: row.ocrModel ?? null,
  };
}
