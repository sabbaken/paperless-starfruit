import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { TagCreate, TagUpdate } from '@paperless-starfruit/shared';
import { tagsApi } from './tags.api';
import { tagKeys } from './tags.keys';

/** Create a tag in paperless (and its local AI hint), then refresh the list. */
export function useCreateTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TagCreate) => tagsApi.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: tagKeys.all });
    },
  });
}

/** Update a tag's paperless fields and/or its local AI hint, then refresh. */
export function useUpdateTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: TagUpdate }) => tagsApi.update(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: tagKeys.all });
    },
  });
}
