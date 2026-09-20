import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { DocumentTypeCreate, DocumentTypeUpdate } from '@paperless-starfruit/shared';
import { documentTypesApi } from './document-types.api';
import { documentTypeKeys } from './document-types.keys';

export function useCreateDocumentType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: DocumentTypeCreate) => documentTypesApi.create(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: documentTypeKeys.all }),
  });
}

export function useUpdateDocumentType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: DocumentTypeUpdate }) =>
      documentTypesApi.update(id, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: documentTypeKeys.all }),
  });
}
