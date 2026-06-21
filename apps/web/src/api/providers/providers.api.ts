import type {
  AvailableModels,
  ProviderConfig,
  ProviderInput,
  ProviderTestInput,
  ProviderTestResult,
  ProviderUpdate,
} from '@paperless-starfruit/shared';
import { http } from '@/api/http';

export const providersApi = {
  list: () => http.get<ProviderConfig[]>('/providers'),

  create: (input: ProviderInput) => http.post<ProviderConfig>('/providers', input),

  update: (id: number, input: ProviderUpdate) =>
    http.put<ProviderConfig>(`/providers/${id}`, input),

  remove: (id: number) => http.delete<void>(`/providers/${id}`),

  test: (input: ProviderTestInput) => http.post<ProviderTestResult>('/providers/test', input),

  models: () => http.get<AvailableModels>('/providers/models'),
};
