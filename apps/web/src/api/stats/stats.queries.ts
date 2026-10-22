import type { StatsPeriod } from '@paperless-starfruit/shared';
import { useQuery } from '@tanstack/react-query';
import { statsApi } from './stats.api';
import { statsKeys } from './stats.keys';

/** Polling/enabled cadence varies by caller (nav badge vs. dashboard). */
interface UseStatsOptions {
  period?: StatsPeriod;
  enabled?: boolean;
  refetchInterval?: number;
}

/** Queue/throughput/cost stats. Pass `options` to tune polling per call site. */
export function useStats({ period = '30', ...options }: UseStatsOptions = {}) {
  return useQuery({
    queryKey: statsKeys.period(period),
    queryFn: () => statsApi.get(period),
    ...options,
  });
}
