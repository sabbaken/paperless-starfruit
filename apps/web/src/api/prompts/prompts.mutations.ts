import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { PromptKey, PromptTestInput } from '@paperless-starfruit/shared';
import { promptsApi } from './prompts.api';
import { promptKeys } from './prompts.keys';

/** Save a prompt override, then refresh the prompt list. */
export function useUpdatePrompt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, body }: { key: PromptKey; body: string }) => promptsApi.update(key, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: promptKeys.all });
    },
  });
}

/** Drop a prompt override (back to the built-in default), then refresh. */
export function useResetPrompt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (key: PromptKey) => promptsApi.reset(key),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: promptKeys.all });
    },
  });
}

/** Run a (possibly unsaved) prompt body against a real document. */
export function useTestPrompt() {
  return useMutation({
    mutationFn: ({ key, input }: { key: PromptKey; input: PromptTestInput }) =>
      promptsApi.test(key, input),
  });
}
