import type { z } from 'zod';
import { PaperlessError } from './paperless.error';
import {
  documentCountSchema,
  paginatedSchema,
  paperlessCorrespondentSchema,
  paperlessDocumentSchema,
  paperlessTagSchema,
  type Paginated,
  type PaperlessCorrespondent,
  type PaperlessDocument,
  type PaperlessTag,
} from './paperless.schemas';

export interface PaperlessClientConfig {
  baseUrl: string;
  token: string;
  /** Omit to auto-detect; when set, pins the `Accept` version header. */
  apiVersion?: number;
}

export interface ConnectionProbe {
  documentCount: number;
  /** paperless release string from `X-Version`, e.g. "2.14.7". */
  version?: string;
  /** API version the server reports via `X-Api-Version`, e.g. 7. */
  apiVersion?: number;
}

export interface ListDocumentsParams {
  tagIds?: number[];
  ordering?: string;
  pageSize?: number;
  page?: number;
}

/** Fields paperless accepts on a PATCH. `tags` replaces the whole array. */
export interface DocumentPatch {
  title?: string;
  tags?: number[];
  correspondent?: number | null;
  created?: string;
  content?: string;
}

const PAGE_SIZE = 200;

/**
 * Typed, version-pinned paperless-ngx REST client. One instance is bound to a
 * single connection (base URL + token + api version); build it from the stored
 * connection via `ConnectionService.getClient()`.
 *
 * Auth is `Authorization: Token <token>`; `Accept` carries the pinned API
 * version. Every JSON response is validated with Zod before it leaves a method.
 */
export class PaperlessClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly apiVersion: number | undefined;

  constructor(config: PaperlessClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.token = config.token;
    this.apiVersion = config.apiVersion;
  }

  /** Cheap reachability + auth check for onboarding's "test connection". */
  async probe(): Promise<ConnectionProbe> {
    const { data, response } = await this.request(
      '/api/documents/?page_size=1',
      documentCountSchema,
    );
    const reported = Number(response.headers.get('x-api-version'));
    return {
      documentCount: data.count,
      version: response.headers.get('x-version') ?? undefined,
      apiVersion: Number.isFinite(reported) && reported > 0 ? reported : undefined,
    };
  }

  listTags(): Promise<PaperlessTag[]> {
    return this.collectAll('/api/tags/', paperlessTagSchema);
  }

  async createTag(name: string, color?: string): Promise<PaperlessTag> {
    const { data } = await this.request('/api/tags/', paperlessTagSchema, {
      method: 'POST',
      body: color ? { name, color } : { name },
    });
    return data;
  }

  async updateTag(id: number, patch: { name?: string; color?: string }): Promise<PaperlessTag> {
    const { data } = await this.request(`/api/tags/${id}/`, paperlessTagSchema, {
      method: 'PATCH',
      body: patch,
    });
    return data;
  }

  listCorrespondents(): Promise<PaperlessCorrespondent[]> {
    return this.collectAll('/api/correspondents/', paperlessCorrespondentSchema);
  }

  async createCorrespondent(name: string): Promise<PaperlessCorrespondent> {
    const { data } = await this.request('/api/correspondents/', paperlessCorrespondentSchema, {
      method: 'POST',
      body: { name },
    });
    return data;
  }

  async listDocuments(
    params: ListDocumentsParams = {},
  ): Promise<{ count: number; results: PaperlessDocument[] }> {
    const schema = paginatedSchema(paperlessDocumentSchema);
    const results: PaperlessDocument[] = [];
    let count = 0;
    // Follow `next` across pages; a single page would starve documents past
    // the first (pending-review docs accumulate at the head of `ordering=added`).
    let next: string | null = `/api/documents/?${this.buildDocumentQuery(params)}`;
    let firstPage = true;
    while (next) {
      const page: Paginated<PaperlessDocument> = (await this.request(next, schema)).data;
      if (firstPage) {
        count = page.count;
        firstPage = false;
      }
      results.push(...page.results);
      next = page.next ? toRelativeUrl(page.next) : null;
    }
    return { count, results };
  }

  /**
   * Most-recently-added documents, a single page (no `next` following), for the
   * "test on a document" picker, where a short, fast list beats every document.
   */
  async listRecentDocuments(limit = 20): Promise<PaperlessDocument[]> {
    const schema = paginatedSchema(paperlessDocumentSchema);
    const query = this.buildDocumentQuery({ ordering: '-added', pageSize: limit });
    const { data } = await this.request(`/api/documents/?${query}`, schema);
    return data.results;
  }

  async getDocument(id: number): Promise<PaperlessDocument> {
    const { data } = await this.request(`/api/documents/${id}/`, paperlessDocumentSchema);
    return data;
  }

  async patchDocument(id: number, patch: DocumentPatch): Promise<PaperlessDocument> {
    const { data } = await this.request(`/api/documents/${id}/`, paperlessDocumentSchema, {
      method: 'PATCH',
      body: patch,
    });
    return data;
  }

  /** Download the original file (for vision OCR). Returns raw bytes, no JSON. */
  async downloadOriginal(id: number): Promise<{ data: Buffer; contentType: string | null }> {
    const response = await this.fetch(`/api/documents/${id}/download/?original=true`, {});
    if (!response.ok) {
      throw new PaperlessError(
        `paperless responded ${response.status} downloading document ${id}`,
        response.status,
        await safeText(response),
      );
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    return { data: bytes, contentType: response.headers.get('content-type') };
  }

  // --- internals -----------------------------------------------------------

  private async collectAll<T>(path: string, item: z.ZodType<T>): Promise<T[]> {
    const schema = paginatedSchema(item);
    const out: T[] = [];
    let next: string | null = `${path}?page_size=${PAGE_SIZE}`;
    while (next) {
      const page: Paginated<T> = (await this.request(next, schema)).data;
      out.push(...page.results);
      // DRF's `next` is an absolute URL built from paperless's own advertised
      // host, which can differ from the base URL the user verified (reverse
      // proxy, container DNS, http/https). Re-anchor to keep every page on the
      // same host fetch() prefixes onto a relative path.
      next = page.next ? toRelativeUrl(page.next) : null;
    }
    return out;
  }

  private buildDocumentQuery(p: ListDocumentsParams): string {
    const sp = new URLSearchParams();
    if (p.tagIds?.length) sp.set('tags__id__in', p.tagIds.join(','));
    sp.set('ordering', p.ordering ?? 'added');
    sp.set('page_size', String(p.pageSize ?? PAGE_SIZE));
    if (p.page) sp.set('page', String(p.page));
    return sp.toString();
  }

  /** Fetch + validate JSON. `body`, when present, is JSON-encoded. */
  private async request<T>(
    pathOrUrl: string,
    schema: z.ZodType<T>,
    init: { method?: string; body?: unknown } = {},
  ): Promise<{ data: T; response: Response }> {
    const response = await this.fetch(pathOrUrl, init);
    if (!response.ok) {
      throw new PaperlessError(
        `paperless responded ${response.status} ${response.statusText} for ${pathLabel(pathOrUrl)}`,
        response.status,
        await safeText(response),
      );
    }
    const json: unknown = await response.json();
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new PaperlessError(
        `Unexpected response shape from ${pathLabel(pathOrUrl)}: ${parsed.error.message}`,
        response.status,
      );
    }
    return { data: parsed.data, response };
  }

  private async fetch(
    pathOrUrl: string,
    init: { method?: string; body?: unknown },
  ): Promise<Response> {
    const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${this.baseUrl}${pathOrUrl}`;
    const headers: Record<string, string> = {
      Authorization: `Token ${this.token}`,
      // No pin -> paperless serves its current API version (avoids a 406 from
      // pinning a version the server doesn't support).
      Accept: this.apiVersion ? `application/json; version=${this.apiVersion}` : 'application/json',
    };
    if (init.body !== undefined) headers['Content-Type'] = 'application/json';
    try {
      return await fetch(url, {
        method: init.method ?? 'GET',
        headers,
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      });
    } catch (err) {
      throw new PaperlessError(
        `Could not reach paperless at ${this.baseUrl}: ${(err as Error).message}`,
      );
    }
  }
}

/** Keep only path+query of an absolute URL so it re-anchors to the base URL. */
function toRelativeUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}`;
  } catch {
    return url;
  }
}

async function safeText(response: Response): Promise<string | undefined> {
  try {
    return (await response.text()).slice(0, 500);
  } catch {
    return undefined;
  }
}

function pathLabel(pathOrUrl: string): string {
  try {
    return pathOrUrl.startsWith('http') ? new URL(pathOrUrl).pathname : pathOrUrl;
  } catch {
    return pathOrUrl;
  }
}
