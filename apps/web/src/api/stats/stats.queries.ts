import { useQuery } from '@tanstack/react-query';
import { statsApi } from './stats.api';
import { statsKeys } from './stats.keys';

/** Polling/enabled cadence varies by caller (nav badge vs. dashboard). */
interface UseStatsOptions {
  enabled?: boolean;
  refetchInterval?: number;
}

/** Queue/throughput/cost stats. Pass `options` to tune polling per call site. */
export function useStats(options?: UseStatsOptions) {
  return useQuery({ queryKey: statsKeys.all, queryFn: statsApi.get, ...options });
}
