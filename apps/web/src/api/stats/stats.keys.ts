import type { StatsPeriod } from '@paperless-starfruit/shared';

export const statsKeys = {
  all: ['stats'] as const,
  period: (period: StatsPeriod) => ['stats', period] as const,
};
