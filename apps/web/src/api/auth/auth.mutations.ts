import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AuthStatus } from '@paperless-starfruit/shared';
import { setToken } from '@/lib/auth-token';
import { authApi } from './auth.api';
import { authKeys } from './auth.keys';

/** Store the new token and refetch everything (now that we're authenticated). */
function useEnter() {
  const queryClient = useQueryClient();
  return (token: string) => {
    setToken(token);
    // Optimistically flip the gate's status so the route guard redirects to the
    // app immediately, with no "not authenticated" flash; the invalidate below
    // re-confirms it in the background.
    queryClient.setQueryData<AuthStatus>(authKeys.status, {
      initialized: true,
      authenticated: true,
    });
    void queryClient.invalidateQueries();
  };
}

/** First-run setup: create the admin account and log straight in. */
export function useRegister() {
  const enter = useEnter();
  return useMutation({ mutationFn: authApi.register, onSuccess: (r) => enter(r.token) });
}

export function useLogin() {
  const enter = useEnter();
  return useMutation({ mutationFn: authApi.login, onSuccess: (r) => enter(r.token) });
}

/** Drop the session and clear cached data. */
export function useLogout() {
  const queryClient = useQueryClient();
  return () => {
    setToken(null);
    queryClient.clear();
    // Seed an unauthenticated status so the guard redirects straight to /login
    // instead of flashing a spinner while it refetches.
    queryClient.setQueryData<AuthStatus>(authKeys.status, {
      initialized: true,
      authenticated: false,
    });
  };
}
