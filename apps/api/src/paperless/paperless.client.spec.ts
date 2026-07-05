import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PaperlessClient } from './paperless.client';
import { PaperlessError } from './paperless.error';

const fetchMock = vi.fn();

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
}

function client(): PaperlessClient {
  // trailing slash is intentional — it must be normalized away
  return new PaperlessClient({ baseUrl: 'http://pl.local/', token: 'tok', apiVersion: 9 });
}

describe('PaperlessClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('probes documents, trims the base URL, pins the version, and detects api version', async () => {
    fetchMock.mockResolvedValue(
      json(
        { count: 42, next: null, previous: null, results: [] },
        { headers: { 'x-version': '2.13.5', 'x-api-version': '7' } },
      ),
    );

    const probe = await client().probe();
    expect(probe).toEqual({ documentCount: 42, version: '2.13.5', apiVersion: 7 });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://pl.local/api/documents/?page_size=1');
    expect(init.headers.Authorization).toBe('Token tok');
    expect(init.headers.Accept).toBe('application/json; version=9');
  });

  it('omits the version pin when no apiVersion is configured (auto-detect)', async () => {
    fetchMock.mockResolvedValue(json({ count: 0, next: null, previous: null, results: [] }));

    const auto = new PaperlessClient({ baseUrl: 'http://pl.local', token: 'tok' });
    await auto.probe();

    expect(fetchMock.mock.calls[0][1].headers.Accept).toBe('application/json');
  });

  it('builds the document query with tag filter, ordering, and page size', async () => {
    fetchMock.mockResolvedValue(json({ count: 0, next: null, previous: null, results: [] }));

    await client().listDocuments({ tagIds: [1, 2], pageSize: 50 });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('tags__id__in=1%2C2');
    expect(url).toContain('ordering=added');
    expect(url).toContain('page_size=50');
  });

  it('follows "next" across pages when listing documents', async () => {
    fetchMock
      .mockResolvedValueOnce(
        json({
          count: 3,
          next: 'http://internal-paperless:8000/api/documents/?page=2&page_size=200',
          previous: null,
          results: [
            {
              id: 1,
              title: 'a',
              content: '',
              tags: [],
              correspondent: null,
              created: '2024-01-01T00:00:00Z',
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        json({
          count: 3,
          next: null,
          previous: null,
          results: [
            {
              id: 2,
              title: 'b',
              content: '',
              tags: [],
              correspondent: null,
              created: '2024-01-01T00:00:00Z',
            },
            {
              id: 3,
              title: 'c',
              content: '',
              tags: [],
              correspondent: null,
              created: '2024-01-01T00:00:00Z',
            },
          ],
        }),
      );

    const { count, results } = await client().listDocuments({ tagIds: [100] });
    expect(count).toBe(3);
    expect(results.map((d) => d.id)).toEqual([1, 2, 3]);
    // Page 2 re-anchors to the verified host, not paperless's advertised internal one.
    expect(fetchMock.mock.calls[1][0]).toBe('http://pl.local/api/documents/?page=2&page_size=200');
  });

  it('creates a tag with a JSON body', async () => {
    fetchMock.mockResolvedValue(json({ id: 7, name: 'psf-process' }, { status: 201 }));

    const tag = await client().createTag('psf-process');
    expect(tag).toEqual({ id: 7, name: 'psf-process' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://pl.local/api/tags/');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body as string)).toEqual({ name: 'psf-process' });
  });

  it('re-anchors paginated "next" links to the configured base URL', async () => {
    fetchMock
      .mockResolvedValueOnce(
        json({
          count: 2,
          // paperless advertises a different internal host than the user entered
          next: 'http://internal-paperless:8000/api/tags/?page=2&page_size=200',
          previous: null,
          results: [{ id: 1, name: 'a' }],
        }),
      )
      .mockResolvedValueOnce(
        json({ count: 2, next: null, previous: null, results: [{ id: 2, name: 'b' }] }),
      );

    const tags = await client().listTags();
    expect(tags).toEqual([
      { id: 1, name: 'a' },
      { id: 2, name: 'b' },
    ]);

    // Page 2 must hit the verified host, not the advertised internal one.
    expect(fetchMock.mock.calls[1][0]).toBe('http://pl.local/api/tags/?page=2&page_size=200');
  });

  it('wraps a non-2xx response in a PaperlessError carrying the status', async () => {
    fetchMock.mockResolvedValue(new Response('forbidden', { status: 403 }));

    const err = await client()
      .probe()
      .then(
        () => null,
        (e: unknown) => e,
      );
    expect(err).toBeInstanceOf(PaperlessError);
    expect((err as PaperlessError).status).toBe(403);
  });

  it('wraps a network failure in a PaperlessError with no status', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    const err = await client()
      .probe()
      .then(
        () => null,
        (e: unknown) => e,
      );
    expect(err).toBeInstanceOf(PaperlessError);
    expect((err as PaperlessError).status).toBeUndefined();
  });
});
