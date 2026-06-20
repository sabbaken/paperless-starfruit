import type { Stats } from '@paperless-ai/shared';
import { http } from '@/api/http';

export const statsApi = {
  get: () => http.get<Stats>('/stats'),
};
