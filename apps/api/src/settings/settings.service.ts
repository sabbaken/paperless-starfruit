import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Settings, SettingsUpdate } from '@paperless-starfruit/shared';
import { DB } from '../db/db.module';
import type { Db } from '../db/client';
import { provider, settings, type SettingsRow } from '../db/schema';

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
    const coerced = this.coerceProviderRefs(patch);
    if (Object.keys(coerced).length > 0) {
      this.db.update(settings).set(coerced).where(eq(settings.id, SETTINGS_ID)).run();
    }
    return this.get();
  }

  /**
   * Don't persist a model whose provider credential doesn't exist (mirrors
   * `ProviderService.remove`'s cleanup): a stale id would make the pipeline
   * throw on every run. Drop the id and its model together; only touch a
   * field the caller actually set to a non-null value.
   */
  private coerceProviderRefs(patch: SettingsUpdate): SettingsUpdate {
    const next = { ...patch };
    if (next.llmProviderId != null && !this.providerExists(next.llmProviderId)) {
      next.llmProviderId = null;
      next.llmModel = null;
    }
    if (next.ocrProviderId != null && !this.providerExists(next.ocrProviderId)) {
      next.ocrProviderId = null;
      next.ocrModel = null;
    }
    return next;
  }

  private providerExists(id: number): boolean {
    return (
      this.db.select({ id: provider.id }).from(provider).where(eq(provider.id, id)).limit(1).all()
        .length > 0
    );
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
    createNewCorrespondents: row.createNewCorrespondents,
    language: row.language,
    ocrEnabled: row.ocrEnabled,
    correspondentBlacklist: row.correspondentBlacklist,
    llmProviderId: row.llmProviderId ?? null,
    llmModel: row.llmModel ?? null,
    ocrProviderId: row.ocrProviderId ?? null,
    ocrModel: row.ocrModel ?? null,
  };
}
