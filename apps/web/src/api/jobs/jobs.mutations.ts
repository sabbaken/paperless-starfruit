import { useMutation, useQueryClient } from '@tanstack/react-query';
import { statsKeys } from '@/api/stats';
import { jobsApi } from './jobs.api';

/** Retry a failed document; refresh the dashboard so the new queued job shows. */
export function useRetryJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (documentId: number) => jobsApi.retry(documentId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: statsKeys.all }),
  });
}

/** Clear the queue; refresh the dashboard so the emptied queue counts show. */
export function useClearQueue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => jobsApi.clearQueue(),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: statsKeys.all }),
  });
}
