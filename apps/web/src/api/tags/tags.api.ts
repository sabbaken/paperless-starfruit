import type { TagCreate, TagUpdate, TagView } from '@paperless-starfruit/shared';
import { http } from '@/api/http';

export const tagsApi = {
  list: () => http.get<TagView[]>('/tags'),

  create: (input: TagCreate) => http.post<TagView>('/tags', input),

  update: (id: number, input: TagUpdate) => http.patch<TagView>(`/tags/${id}`, input),
};
