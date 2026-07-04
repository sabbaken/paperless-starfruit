import { useQuery } from '@tanstack/react-query';
import { tagsApi } from './tags.api';
import { tagKeys } from './tags.keys';

/** Every paperless tag, merged with its local AI hint. Needs a live connection. */
export function useTags() {
  return useQuery({ queryKey: tagKeys.all, queryFn: tagsApi.list, retry: false });
}
