import type {
  PromptConfig,
  PromptKey,
  PromptTestInput,
  PromptTestResult,
  TestDocument,
} from '@paperless-starfruit/shared';
import { http } from '@/api/http';

export const promptsApi = {
  list: () => http.get<PromptConfig[]>('/prompts'),

  documents: () => http.get<TestDocument[]>('/prompts/documents'),

  update: (key: PromptKey, body: string) => http.put<PromptConfig>(`/prompts/${key}`, { body }),

  reset: (key: PromptKey) => http.post<PromptConfig>(`/prompts/${key}/reset`),

  test: (key: PromptKey, input: PromptTestInput) =>
    http.post<PromptTestResult>(`/prompts/${key}/test`, input),
};
