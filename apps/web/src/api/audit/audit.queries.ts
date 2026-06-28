import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { AuditQuery } from '@paperless-starfruit/shared';
import { auditApi } from './audit.api';
import { auditKeys } from './audit.keys';

/** A filtered page of the audit/history log. */
export function useAuditLog(query: Partial<AuditQuery> = {}) {
  return useQuery({
    queryKey: auditKeys.list(query),
    queryFn: () => auditApi.list(query),
    // Keep the current page on screen while the next page/filter loads, instead of
    // flashing to a spinner and losing scroll position on every change.
    placeholderData: keepPreviousData,
  });
}

/** Full detail (prompt + model response) for one entry; skipped while `id` is null. */
export function useAuditDetail(id: number | null) {
  return useQuery({
    queryKey: auditKeys.detail(id ?? -1),
    queryFn: () => auditApi.get(id as number),
    enabled: id != null,
  });
}
