import type { Stats } from '@paperless-starfruit/shared';
import { http } from '@/api/http';

export const statsApi = {
  get: () => http.get<Stats>('/stats'),
};
