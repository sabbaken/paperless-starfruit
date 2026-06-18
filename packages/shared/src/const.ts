/** Job lifecycle — deliberately minimal (no backoff/dead-letter for a single-user app). */
export const JOB_STATUS = {
  QUEUED: 'queued',
  RUNNING: 'running',
  DONE: 'done',
  FAILED: 'failed',
} as const;
export type JobStatus = (typeof JOB_STATUS)[keyof typeof JOB_STATUS];

/** Statuses that count as "in flight" for the one-active-job-per-document guard. */
export const ACTIVE_JOB_STATUSES: JobStatus[] = [JOB_STATUS.QUEUED, JOB_STATUS.RUNNING];

/** Default paperless-ngx trigger tags. `auto` applies instantly; `review` queues for approval. */
export const DEFAULT_TRIGGER_TAGS = {
  review: 'ai-process',
  auto: 'ai-process-auto',
} as const;

/** Provider families. OpenAI-compatible covers Ollama / LM Studio / vLLM / OpenRouter. */
export const PROVIDER_KIND = {
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  GOOGLE: 'google',
  MISTRAL: 'mistral',
  OPENAI_COMPATIBLE: 'openai-compatible',
} as const;
export type ProviderKind = (typeof PROVIDER_KIND)[keyof typeof PROVIDER_KIND];

/** Prompt template keys, one per extracted field (+ ocr). */
export const PROMPT_KEY = {
  TITLE: 'title',
  TAGS: 'tags',
  CORRESPONDENT: 'correspondent',
  DATE: 'date',
  OCR: 'ocr',
} as const;
export type PromptKey = (typeof PROMPT_KEY)[keyof typeof PROMPT_KEY];
