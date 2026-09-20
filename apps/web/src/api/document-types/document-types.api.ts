import type {
  DocumentTypeCreate,
  DocumentTypeUpdate,
  DocumentTypeView,
} from '@paperless-starfruit/shared';
import { http } from '@/api/http';

export const documentTypesApi = {
  list: () => http.get<DocumentTypeView[]>('/document-types'),
  create: (input: DocumentTypeCreate) => http.post<DocumentTypeView>('/document-types', input),
  update: (id: number, input: DocumentTypeUpdate) =>
    http.patch<DocumentTypeView>(`/document-types/${id}`, input),
};
