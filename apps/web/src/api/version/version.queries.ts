import { useQuery } from '@tanstack/react-query';
import { versionApi } from './version.api';
import { versionKeys } from './version.keys';

/** Update status: the running build vs the latest published release. */
export function useVersion() {
  return useQuery({
    queryKey: versionKeys.all,
    queryFn: versionApi.get,
    // The backend caches the upstream manifest for hours, so the client can poll
    // lazily: fresh for an hour, with a slow background refresh for long sessions.
    staleTime: 60 * 60 * 1000,
    refetchInterval: 6 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
