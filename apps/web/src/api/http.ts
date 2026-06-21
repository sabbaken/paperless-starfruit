import { getToken, setToken } from '@/lib/auth-token';

/** A request that reached the server but came back non-2xx. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    // Expired/invalid session — drop the token so the auth gate flips to login
    // instead of every page surfacing a 401.
    if (res.status === 401) setToken(null);
    throw new ApiError(await errorMessage(res), res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function errorMessage(res: Response): Promise<string> {
  try {
    const body: unknown = await res.json();
    if (body && typeof body === 'object') {
      // ZodValidationPipe emits { message: 'Validation failed', issues: [{path, message}] }.
      // Prefer the field-level issues so the user sees which field was wrong.
      const issues = (body as { issues?: unknown }).issues;
      if (Array.isArray(issues) && issues.length > 0) {
        return issues
          .map((i) => {
            const { path, message } = i as { path?: string; message?: string };
            return path ? `${path}: ${message}` : (message ?? '');
          })
          .filter(Boolean)
          .join('; ');
      }
      const message = (body as { message?: unknown }).message;
      if (typeof message === 'string') return message;
      if (Array.isArray(message)) return message.join(', ');
    }
  } catch {
    /* fall through to a generic message */
  }
  return `Request failed (${res.status})`;
}

const body = (value: unknown) => (value === undefined ? undefined : JSON.stringify(value));

/**
 * Thin fetch client. Every call is prefixed with `/api`, sends JSON, and runs
 * the shared error "interceptor" (`errorMessage`) so callers only ever deal
 * with parsed data or an {@link ApiError}.
 */
export const http = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, payload?: unknown) =>
    request<T>(path, { method: 'POST', body: body(payload) }),
  put: <T>(path: string, payload?: unknown) =>
    request<T>(path, { method: 'PUT', body: body(payload) }),
  patch: <T>(path: string, payload?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body(payload) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
