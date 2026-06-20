import { useQuery } from '@tanstack/react-query';
import { reviewApi } from './review.api';
import { reviewKeys } from './review.keys';

/** Items awaiting review for the given status; polls so the queue stays fresh. */
export function useReviewList(status = 'pending') {
  return useQuery({
    queryKey: reviewKeys.list(status),
    queryFn: () => reviewApi.list(status),
    refetchInterval: 5000,
  });
}

/** Full detail (document text + AI suggestions) for a single review item. */
export function useReviewDetail(id: number) {
  return useQuery({ queryKey: reviewKeys.detail(id), queryFn: () => reviewApi.get(id) });
}
