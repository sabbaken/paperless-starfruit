/**
 * The admin session token, persisted in localStorage and observable so the auth
 * gate re-renders the moment it changes (login, logout, or a 401 clearing it).
 * Bearer-token auth (not cookies) is why localStorage is fine here.
 */
const KEY = 'paperless-starfruit.token';
const listeners = new Set<() => void>();

export function getToken(): string | null {
  return localStorage.getItem(KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(KEY, token);
  else localStorage.removeItem(KEY);
  listeners.forEach((notify) => notify());
}

/** Subscribe to token changes (for `useSyncExternalStore`). */
export function subscribeToken(notify: () => void): () => void {
  listeners.add(notify);
  return () => listeners.delete(notify);
}
