import type { AuditEntryDetail, AuditList, AuditQuery } from '@paperless-starfruit/shared';
import { http } from '@/api/http';

function toQueryString(query: Partial<AuditQuery>): string {
  const params = new URLSearchParams();
  if (query.documentId != null) params.set('documentId', String(query.documentId));
  if (query.decision) params.set('decision', query.decision);
  if (query.q) params.set('q', query.q);
  if (query.limit != null) params.set('limit', String(query.limit));
  if (query.offset != null) params.set('offset', String(query.offset));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const auditApi = {
  list: (query: Partial<AuditQuery> = {}) => http.get<AuditList>(`/audit${toQueryString(query)}`),
  get: (id: number) => http.get<AuditEntryDetail>(`/audit/${id}`),
};
