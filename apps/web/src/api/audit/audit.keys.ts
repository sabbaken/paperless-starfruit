import type { AuditQuery } from '@paperless-starfruit/shared';

export const auditKeys = {
  all: ['audit'] as const,
  list: (query: Partial<AuditQuery>) => ['audit', 'list', query] as const,
  detail: (id: number) => ['audit', 'detail', id] as const,
};
