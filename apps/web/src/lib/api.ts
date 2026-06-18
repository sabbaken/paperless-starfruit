import type {
  ConnectionStatus,
  ConnectionTestResult,
  PaperlessConnectionInput,
} from '@paperless-ai/shared';

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
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

  if (!res.ok) {
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

export const connectionApi = {
  get: () => request<ConnectionStatus>('/connection'),

  test: (input: PaperlessConnectionInput) =>
    request<ConnectionTestResult>('/connection/test', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  save: (input: PaperlessConnectionInput) =>
    request<ConnectionStatus>('/connection', {
      method: 'PUT',
      body: JSON.stringify(input),
    }),

  remove: () => request<void>('/connection', { method: 'DELETE' }),
};
