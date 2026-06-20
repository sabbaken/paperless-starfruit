import { PROVIDER_KIND, type ProviderKind } from './const';

/** A model offered to the user in the picker. */
export interface CatalogModel {
  id: string;
  label: string;
  /** Vision-capable — required for OCR; surfaced as a badge in the picker. */
  vision: boolean;
  /**
   * Coarse "how smart" rating from 0 to 5, for users who don't know the model
   * names. Subjective and editable — bump as the provider lineup shifts.
   */
  intelligence: number;
}

/**
 * Curated, current-ish models per cloud provider — the "suitable" subset shown
 * in the picker (not every model the API technically exposes). Editable as
 * providers ship new models. OpenAI-compatible endpoints are discovered live, so
 * they carry no catalog entries here.
 */
export const MODEL_CATALOG: Record<ProviderKind, CatalogModel[]> = {
  [PROVIDER_KIND.ANTHROPIC]: [
    { id: 'claude-opus-4-5', label: 'Claude Opus 4.5', vision: true, intelligence: 5 },
    { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', vision: true, intelligence: 4 },
    { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', vision: true, intelligence: 3 },
  ],
  [PROVIDER_KIND.OPENAI]: [
    { id: 'gpt-4.1', label: 'GPT-4.1', vision: true, intelligence: 4 },
    { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini', vision: true, intelligence: 3 },
    { id: 'gpt-4o', label: 'GPT-4o', vision: true, intelligence: 4 },
    { id: 'gpt-4o-mini', label: 'GPT-4o mini', vision: true, intelligence: 2 },
    { id: 'o4-mini', label: 'o4-mini', vision: true, intelligence: 4 },
  ],
  [PROVIDER_KIND.GOOGLE]: [
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', vision: true, intelligence: 5 },
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', vision: true, intelligence: 4 },
    { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', vision: true, intelligence: 3 },
  ],
  [PROVIDER_KIND.MISTRAL]: [
    { id: 'mistral-large-latest', label: 'Mistral Large', vision: false, intelligence: 4 },
    { id: 'mistral-small-latest', label: 'Mistral Small', vision: false, intelligence: 2 },
    { id: 'pixtral-large-latest', label: 'Pixtral Large', vision: true, intelligence: 3 },
  ],
  [PROVIDER_KIND.OPENAI_COMPATIBLE]: [],
};

/** First catalog model for a kind — used as the probe model for a key test. */
export function defaultModelFor(kind: ProviderKind): string | null {
  return MODEL_CATALOG[kind][0]?.id ?? null;
}
