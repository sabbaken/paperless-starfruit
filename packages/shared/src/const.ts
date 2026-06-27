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

/**
 * The single paperless-ngx tag that marks a document for AI processing. Whether a
 * processed document is auto-applied or queued for human review is decided by the
 * `autoApply` setting, not by the tag.
 */
export const DEFAULT_TRIGGER_TAG = 'psf-process';

/** Review-item lifecycle. `pending` waits on the user; the rest are terminal. */
export const REVIEW_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;
export type ReviewStatus = (typeof REVIEW_STATUS)[keyof typeof REVIEW_STATUS];

/** Provider families. OpenAI-compatible covers Ollama / LM Studio / vLLM / OpenRouter. */
export const PROVIDER_KIND = {
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  GOOGLE: 'google',
  MISTRAL: 'mistral',
  OPENAI_COMPATIBLE: 'openai-compatible',
} as const;
export type ProviderKind = (typeof PROVIDER_KIND)[keyof typeof PROVIDER_KIND];

/**
 * Presentation + behaviour metadata per provider kind. `local` distinguishes a
 * self-hosted OpenAI-compatible endpoint (models discovered live, base URL
 * required, key optional) from the cloud providers (one slotted key each, models
 * from the curated catalog).
 */
export interface ProviderKindMeta {
  label: string;
  description: string;
  local: boolean;
  needsBaseUrl: boolean;
  keyRequired: boolean;
}

export const PROVIDER_KIND_META: Record<ProviderKind, ProviderKindMeta> = {
  [PROVIDER_KIND.ANTHROPIC]: {
    label: 'Anthropic',
    description: 'Claude models',
    local: false,
    needsBaseUrl: false,
    keyRequired: true,
  },
  [PROVIDER_KIND.OPENAI]: {
    label: 'OpenAI',
    description: 'GPT / o-series models',
    local: false,
    needsBaseUrl: false,
    keyRequired: true,
  },
  [PROVIDER_KIND.GOOGLE]: {
    label: 'Google',
    description: 'Gemini models',
    local: false,
    needsBaseUrl: false,
    keyRequired: true,
  },
  [PROVIDER_KIND.MISTRAL]: {
    label: 'Mistral',
    description: 'Mistral / Pixtral models',
    local: false,
    needsBaseUrl: false,
    keyRequired: true,
  },
  [PROVIDER_KIND.OPENAI_COMPATIBLE]: {
    label: 'OpenAI-compatible',
    description: 'Local & self-hosted: Ollama, LM Studio, vLLM, OpenRouter',
    local: true,
    needsBaseUrl: true,
    keyRequired: false,
  },
};

/** Cloud kinds get a single slotted key each; locals can have many endpoints. */
export const CLOUD_PROVIDER_KINDS: ProviderKind[] = [
  PROVIDER_KIND.ANTHROPIC,
  PROVIDER_KIND.OPENAI,
  PROVIDER_KIND.GOOGLE,
  PROVIDER_KIND.MISTRAL,
];

/**
 * The two prompts the user can fully customise. There are exactly two LLM calls
 * with editable text — the single metadata-extraction call and the vision-LLM OCR
 * call — so there are two templates, each a whole prompt (not per-field snippets).
 */
export const PROMPT_KEY = {
  EXTRACTION: 'extraction',
  OCR: 'ocr',
} as const;
export type PromptKey = (typeof PROMPT_KEY)[keyof typeof PROMPT_KEY];
