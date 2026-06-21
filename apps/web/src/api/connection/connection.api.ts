import type {
  ConnectionStatus,
  ConnectionTestResult,
  PaperlessConnectionInput,
} from '@paperless-starfruit/shared';
import { http } from '@/api/http';

export const connectionApi = {
  get: () => http.get<ConnectionStatus>('/connection'),

  test: (input: PaperlessConnectionInput) =>
    http.post<ConnectionTestResult>('/connection/test', input),

  save: (input: PaperlessConnectionInput) => http.put<ConnectionStatus>('/connection', input),

  remove: () => http.delete<void>('/connection'),
};
