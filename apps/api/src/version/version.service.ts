import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { latestReleaseSchema, type VersionInfo } from '@paperless-starfruit/shared';
import { SettingsService } from '../settings/settings.service';

/** Where the latest published release lives. Override per-deployment if you fork. */
const DEFAULT_RELEASE_API_URL =
  'https://api.github.com/repos/sabbaken/paperless-starfruit/releases/latest';
/** Fallback "where to upgrade" link when the release response carries no page URL. */
const DEFAULT_RELEASE_URL = 'https://github.com/sabbaken/paperless-starfruit/releases';
/** Cache a good response this long — update checks are cheap and rare. */
const OK_TTL_MS = 6 * 60 * 60 * 1000;
/** Cache a failed fetch only briefly so a transient outage self-heals. */
const ERROR_TTL_MS = 10 * 60 * 1000;
const FETCH_TIMEOUT_MS = 5000;

interface Cached {
  fetchedAt: number;
  ok: boolean;
  version: string | null;
  releaseUrl: string | null;
}

/**
 * Resolves update status for `GET /api/version`: the running build's version vs
 * the latest GitHub release. The opt-out is honoured at the network layer — when
 * `checkForUpdates` is off we never reach out to GitHub at all.
 */
@Injectable()
export class VersionService {
  private readonly logger = new Logger(VersionService.name);
  private readonly current = process.env.APP_VERSION || readProductVersion();
  private readonly releaseApiUrl = process.env.UPDATE_CHECK_URL || DEFAULT_RELEASE_API_URL;
  private cache: Cached | null = null;

  constructor(private readonly settings: SettingsService) {}

  async getInfo(now: number = Date.now()): Promise<VersionInfo> {
    const offline: VersionInfo = {
      current: this.current,
      latest: null,
      updateAvailable: false,
      releaseUrl: null,
    };
    if (!this.settings.get().checkForUpdates) return offline;

    const release = await this.latestRelease(now);
    if (!release.version) return offline;

    return {
      current: this.current,
      latest: release.version,
      updateAvailable: isNewer(release.version, this.current),
      releaseUrl: release.releaseUrl ?? DEFAULT_RELEASE_URL,
    };
  }

  private async latestRelease(now: number): Promise<Cached> {
    const ttl = this.cache?.ok ? OK_TTL_MS : ERROR_TTL_MS;
    if (this.cache && now - this.cache.fetchedAt < ttl) return this.cache;

    try {
      const res = await fetch(this.releaseApiUrl, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { accept: 'application/vnd.github+json' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const parsed = latestReleaseSchema.parse(await res.json());
      this.cache = {
        fetchedAt: now,
        ok: true,
        version: parsed.tag_name.replace(/^v/, ''),
        releaseUrl: parsed.html_url ?? null,
      };
    } catch (err) {
      // A failed update check must never surface as an error in the UI.
      this.logger.debug(`update check failed: ${err instanceof Error ? err.message : String(err)}`);
      this.cache = { fetchedAt: now, ok: false, version: null, releaseUrl: null };
    }
    return this.cache;
  }
}

/**
 * Dev fallback for the product version: the monorepo root `package.json`.
 * Published images stamp the release tag via APP_VERSION instead. Walk up from
 * this compiled module until we find the root package by name, so the lookup is
 * independent of the build's directory nesting and cwd.
 */
function readProductVersion(): string {
  let dir = __dirname;
  for (let depth = 0; depth < 8; depth += 1) {
    try {
      const pkg = JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf8')) as {
        name?: string;
        version?: string;
      };
      if (pkg.name === 'paperless-starfruit') return pkg.version ?? '0.0.0';
    } catch {
      /* no package.json here — keep climbing */
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return '0.0.0';
}

/** Strict-greater compare on major.minor.patch (any pre-release/build suffix ignored). */
function isNewer(latest: string, current: string): boolean {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  for (let i = 0; i < 3; i += 1) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return false;
}

function parseVersion(v: string): [number, number, number] {
  const core = v.trim().replace(/^v/, '').split(/[-+]/)[0];
  const parts = core.split('.');
  const n = (i: number): number => {
    const parsed = Number.parseInt(parts[i] ?? '', 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  };
  return [n(0), n(1), n(2)];
}
