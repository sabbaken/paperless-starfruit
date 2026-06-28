import { http } from '@/api/http';

export const jobsApi = {
  /** Retry a terminally-failed document (clears its failed jobs and re-enqueues). */
  retry: (documentId: number) => http.post<void>(`/jobs/${documentId}/retry`),
};
