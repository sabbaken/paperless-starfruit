import { useQuery } from '@tanstack/react-query';
import { providersApi } from './providers.api';
import { providerKeys } from './providers.keys';

/** Configured AI providers (cloud keys + local endpoints). */
export function useProviders() {
  return useQuery({ queryKey: providerKeys.all, queryFn: providersApi.list });
}

/** Models exposed by the connected providers, grouped by provider. */
export function useAvailableModels() {
  return useQuery({ queryKey: providerKeys.models, queryFn: providersApi.models });
}
