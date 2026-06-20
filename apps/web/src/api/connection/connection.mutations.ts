import { useMutation, useQueryClient } from '@tanstack/react-query';
import { connectionApi } from './connection.api';
import { connectionKeys } from './connection.keys';

/** Probe an instance without persisting anything. */
export function useTestConnection() {
  return useMutation({ mutationFn: connectionApi.test });
}

/** Save (and verify) the connection, then refresh the cached status. */
export function useSaveConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: connectionApi.save,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: connectionKeys.all });
    },
  });
}

/** Forget the stored connection. */
export function useDisconnect() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: connectionApi.remove,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: connectionKeys.all });
    },
  });
}
