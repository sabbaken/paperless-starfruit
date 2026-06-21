import type { ReviewApprove, ReviewDetail, ReviewItemView } from '@paperless-starfruit/shared';
import { http } from '@/api/http';

/** Outcome of a single item inside a bulk-approve request. */
export interface BulkResult {
  id: number;
  ok: boolean;
  error?: string;
}

export const reviewApi = {
  list: (status = 'pending') =>
    http.get<ReviewItemView[]>(`/review?status=${encodeURIComponent(status)}`),

  get: (id: number) => http.get<ReviewDetail>(`/review/${id}`),

  approve: (id: number, payload: ReviewApprove) =>
    http.post<void>(`/review/${id}/approve`, payload),

  reject: (id: number) => http.post<void>(`/review/${id}/reject`),

  bulkApprove: (ids: number[]) => http.post<BulkResult[]>('/review/bulk-approve', { ids }),
};
