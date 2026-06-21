import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ProviderInput, ProviderUpdate } from '@paperless-starfruit/shared';
import { settingsKeys } from '@/api/settings';
import { providersApi } from './providers.api';
import { providerKeys } from './providers.keys';

/** Add a provider credential, then refresh the provider + model lists. */
export function useCreateProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ProviderInput) => providersApi.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: providerKeys.all });
      void queryClient.invalidateQueries({ queryKey: providerKeys.models });
    },
  });
}

/** Update a provider credential, then refresh the provider + model lists. */
export function useUpdateProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: ProviderUpdate }) =>
      providersApi.update(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: providerKeys.all });
      void queryClient.invalidateQueries({ queryKey: providerKeys.models });
    },
  });
}

/**
 * Remove a provider. Also invalidates settings, since dropping a provider can
 * orphan the LLM/OCR model selection that referenced it.
 */
export function useDeleteProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => providersApi.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: providerKeys.all });
      void queryClient.invalidateQueries({ queryKey: providerKeys.models });
      void queryClient.invalidateQueries({ queryKey: settingsKeys.all });
    },
  });
}

/** Probe a provider credential without persisting it. */
export function useTestProvider() {
  return useMutation({ mutationFn: providersApi.test });
}
