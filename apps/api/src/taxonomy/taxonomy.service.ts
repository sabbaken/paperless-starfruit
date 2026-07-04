import { Injectable } from '@nestjs/common';
import {
  DEFAULT_TRIGGER_TAG,
  TRIGGER_TAG_COLOR,
  type ResolvedTag,
} from '@paperless-starfruit/shared';
import type { PaperlessClient } from '../paperless/paperless.client';
import type { PaperlessCorrespondent, PaperlessTag } from '../paperless/paperless.schemas';

/** One consistent view of the paperless taxonomy (what `getSnapshot` returns). */
export interface TaxonomySnapshot {
  tags: PaperlessTag[];
  correspondents: PaperlessCorrespondent[];
}

interface Snapshot extends TaxonomySnapshot {
  fetchedAt: number;
}

const SNAPSHOT_TTL_MS = 60_000;

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Caches the paperless tag/correspondent taxonomy between polls and reconciles
 * AI-suggested names to ids (create-if-missing). The cache is single-connection
 * (this is a single-instance app); it self-refreshes on a short TTL and is kept
 * warm incrementally when new entities are created.
 */
@Injectable()
export class TaxonomyService {
  private snapshot: Snapshot | null = null;
  private triggerTagId: number | null = null;

  async getSnapshot(client: PaperlessClient, force = false): Promise<TaxonomySnapshot> {
    if (!force && this.snapshot && Date.now() - this.snapshot.fetchedAt < SNAPSHOT_TTL_MS) {
      return this.snapshot;
    }
    const [tags, correspondents] = await Promise.all([
      client.listTags(),
      client.listCorrespondents(),
    ]);
    this.snapshot = { fetchedAt: Date.now(), tags, correspondents };
    return this.snapshot;
  }

  /** Resolve (creating if missing, in brand yellow) the trigger tag id. Cached for the process. */
  async resolveTriggerTag(client: PaperlessClient): Promise<number> {
    if (this.triggerTagId != null) return this.triggerTagId;
    this.triggerTagId = await this.ensureTag(client, DEFAULT_TRIGGER_TAG, TRIGGER_TAG_COLOR);
    return this.triggerTagId;
  }

  /**
   * Map suggested tag names to ids. With `create`, missing tags are created in
   * paperless now; without it, they come back with `id: null` (creation deferred
   * to review approval). Names are de-duplicated case-insensitively. Pass
   * `snapshot` to resolve against a caller-pinned taxonomy view (the pipeline
   * pins the one its prompt was rendered from).
   */
  async resolveTags(
    client: PaperlessClient,
    names: string[],
    opts: { create: boolean; snapshot?: TaxonomySnapshot },
  ): Promise<ResolvedTag[]> {
    const snap = opts.snapshot ?? (await this.getSnapshot(client));
    const out: ResolvedTag[] = [];
    const seen = new Set<string>();
    for (const raw of names) {
      const name = raw.trim();
      if (!name || seen.has(norm(name))) continue;
      seen.add(norm(name));

      const existing = snap.tags.find((t) => norm(t.name) === norm(name));
      if (existing) {
        out.push({ id: existing.id, name: existing.name, isNew: false });
      } else if (opts.create) {
        const created = await client.createTag(name);
        snap.tags.push(created);
        out.push({ id: created.id, name: created.name, isNew: true });
      } else {
        out.push({ id: null, name, isNew: true });
      }
    }
    return out;
  }

  /** Resolve a suggested correspondent; blacklisted names are dropped (returns null). */
  async resolveCorrespondent(
    client: PaperlessClient,
    name: string | null,
    opts: { create: boolean; blacklist: string[]; snapshot?: TaxonomySnapshot },
  ): Promise<ResolvedTag | null> {
    const trimmed = name?.trim();
    if (!trimmed) return null;
    if (opts.blacklist.some((b) => norm(b) === norm(trimmed))) return null;

    const snap = opts.snapshot ?? (await this.getSnapshot(client));
    const existing = snap.correspondents.find((c) => norm(c.name) === norm(trimmed));
    if (existing) return { id: existing.id, name: existing.name, isNew: false };
    if (opts.create) {
      const created = await client.createCorrespondent(trimmed);
      snap.correspondents.push(created);
      return { id: created.id, name: created.name, isNew: true };
    }
    return { id: null, name: trimmed, isNew: true };
  }

  /** Names for a set of tag ids (for the review diff's "current" side). */
  async tagNames(client: PaperlessClient, ids: number[]): Promise<string[]> {
    const snap = await this.getSnapshot(client);
    return ids
      .map((id) => snap.tags.find((t) => t.id === id)?.name)
      .filter((n): n is string => !!n);
  }

  async correspondentName(client: PaperlessClient, id: number | null): Promise<string | null> {
    if (id == null) return null;
    const snap = await this.getSnapshot(client);
    return snap.correspondents.find((c) => c.id === id)?.name ?? null;
  }

  /** Drop caches (e.g. after the paperless connection changes). */
  invalidate(): void {
    this.snapshot = null;
    this.triggerTagId = null;
  }

  /** Drop only the tag/correspondent snapshot (after editing the taxonomy). */
  invalidateSnapshot(): void {
    this.snapshot = null;
  }

  private async ensureTag(
    client: PaperlessClient,
    name: string,
    color?: string,
  ): Promise<number> {
    const snap = await this.getSnapshot(client);
    const existing = snap.tags.find((t) => norm(t.name) === norm(name));
    if (existing) return existing.id;
    const created = await client.createTag(name, color);
    snap.tags.push(created);
    return created.id;
  }
}
