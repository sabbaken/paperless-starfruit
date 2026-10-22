import type { Stats, StatsPeriod } from '@paperless-starfruit/shared';
import { http } from '@/api/http';

export const statsApi = {
  get: (period: StatsPeriod = '30') => http.get<Stats>(`/stats?period=${period}`),
};
