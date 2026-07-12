import { useQuery } from '@tanstack/react-query';
import { promptsApi } from './prompts.api';
import { promptKeys } from './prompts.keys';

/** The two editable prompts (effective body + default + customized flag). */
export function usePrompts() {
  return useQuery({ queryKey: promptKeys.all, queryFn: promptsApi.list });
}

/**
 * Recent documents for the "test on a document" picker. Only fetched when a test
 * panel is open (`enabled`). It needs a live paperless connection, so eager
 * fetching would surface an error on a fresh install.
 */
export function useTestDocuments(enabled: boolean) {
  return useQuery({
    queryKey: promptKeys.documents,
    queryFn: promptsApi.documents,
    enabled,
    retry: false,
  });
}
