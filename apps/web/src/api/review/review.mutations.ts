import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ReviewApprove } from '@paperless-starfruit/shared';
import { statsKeys } from '@/api/stats';
import { reviewApi } from './review.api';
import { reviewKeys } from './review.keys';

/** Invalidate everything that a resolved review item changes. */
function useResolveReview() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: reviewKeys.all });
    void queryClient.invalidateQueries({ queryKey: statsKeys.all });
  };
}

/** Approve a single item with the (possibly edited) suggestions. */
export function useApproveReview() {
  const onResolved = useResolveReview();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: ReviewApprove }) =>
      reviewApi.approve(id, payload),
    onSuccess: onResolved,
  });
}

/** Reject a single item. */
export function useRejectReview() {
  const onResolved = useResolveReview();
  return useMutation({ mutationFn: (id: number) => reviewApi.reject(id), onSuccess: onResolved });
}

/** Approve many items at once. */
export function useBulkApproveReview() {
  const onResolved = useResolveReview();
  return useMutation({
    mutationFn: (ids: number[]) => reviewApi.bulkApprove(ids),
    onSuccess: onResolved,
  });
}
