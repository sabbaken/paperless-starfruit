import { useQuery } from '@tanstack/react-query';
import { connectionApi } from './connection.api';
import { connectionKeys } from './connection.keys';

/** Current paperless connection status; the app's onboarding gate reads this. */
export function useConnection() {
  return useQuery({ queryKey: connectionKeys.all, queryFn: connectionApi.get });
}
