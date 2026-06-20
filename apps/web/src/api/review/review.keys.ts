export const reviewKeys = {
  /** Prefix matching every review query (lists + details). */
  all: ['review'] as const,
  list: (status: string) => ['review', status] as const,
  detail: (id: number) => ['review', id] as const,
};
