import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '@/api/http';

/** Shared React Query client for the whole app. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Don't retry client errors (401/403/404…) — a 401 already cleared the
      // token, so retrying just spams the server with doomed requests.
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
        return failureCount < 3;
      },
    },
  },
});
