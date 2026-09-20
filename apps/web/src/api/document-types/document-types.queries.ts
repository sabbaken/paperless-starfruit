import { useQuery } from '@tanstack/react-query';
import { documentTypesApi } from './document-types.api';
import { documentTypeKeys } from './document-types.keys';

export function useDocumentTypes() {
  return useQuery({
    queryKey: documentTypeKeys.all,
    queryFn: documentTypesApi.list,
    retry: false,
  });
}
