import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SettingsService } from '../settings/settings.service';
import { VersionService } from './version.service';

const CURRENT = '1.2.3';

function service(checkForUpdates: boolean): VersionService {
  const settings = { get: () => ({ checkForUpdates }) } as unknown as SettingsService;
  return new VersionService(settings);
}

function jsonResponse(body: unknown): Response {
  return { ok: true, status: 200, json: () => Promise.resolve(body) } as unknown as Response;
}

describe('VersionService', () => {
  beforeEach(() => {
    // Pin the running version so comparisons are deterministic.
    process.env.APP_VERSION = CURRENT;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.APP_VERSION;
  });

  it('never touches the network when checks are disabled', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const info = await service(false).getInfo();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(info).toEqual({
      current: CURRENT,
      latest: null,
      updateAvailable: false,
      releaseUrl: null,
    });
  });

  it('flags an update when the latest release is newer, stripping the tag `v` prefix', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse({ tag_name: 'v2.0.0' }))),
    );

    const info = await service(true).getInfo();

    expect(info.current).toBe(CURRENT);
    expect(info.latest).toBe('2.0.0');
    expect(info.updateAvailable).toBe(true);
    expect(info.releaseUrl).toContain('/releases');
  });

  it('reports up-to-date when the latest release is not newer', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse({ tag_name: 'v1.2.3' }))),
    );

    const info = await service(true).getInfo();

    expect(info.latest).toBe('1.2.3');
    expect(info.updateAvailable).toBe(false);
  });

  it('links to the release page when the response carries one', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse({ tag_name: 'v9.9.9', html_url: 'https://example.com/releases/tag/v9.9.9' }),
        ),
      ),
    );

    const info = await service(true).getInfo();

    expect(info.releaseUrl).toBe('https://example.com/releases/tag/v9.9.9');
  });

  it('degrades silently on a fetch error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('network down'))),
    );

    const info = await service(true).getInfo();

    expect(info).toEqual({
      current: CURRENT,
      latest: null,
      updateAvailable: false,
      releaseUrl: null,
    });
  });
});
