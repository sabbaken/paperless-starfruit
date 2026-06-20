import { useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from './settings.api';
import { settingsKeys } from './settings.keys';

/** Patch settings, then refresh the cached settings. */
export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: settingsApi.update,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: settingsKeys.all });
    },
  });
}
