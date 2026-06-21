import { useQuery } from '@tanstack/react-query';
import { authApi } from './auth.api';
import { authKeys } from './auth.keys';

/** Public bootstrap state the auth gate reads: claimed yet? token still valid? */
export function useAuthStatus() {
  return useQuery({ queryKey: authKeys.status, queryFn: authApi.status });
}
