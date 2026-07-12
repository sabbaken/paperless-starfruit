import { CLOUD_PROVIDER_KINDS, PROVIDER_KIND, type ProviderKind } from './const';
import { OCR_MODELS, type ModelInfo, type ProviderModels } from './schemas/models';

/** A model offered to the user in the picker. */
export interface CatalogModel {
  id: string;
  label: string;
  /** Vision-capable: required for OCR; surfaced as a badge in the picker. */
  vision: boolean;
  /**
   * Coarse "how smart" rating from 0 to 5, for users who don't know the model
   * names. Subjective and editable. Bump as the provider lineup shifts.
   */
  intelligence: number;
}

/**
 * Curated, current-ish models per cloud provider: the "suitable" subset shown
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

/** First catalog model for a kind, used as the probe model for a key test. */
export function defaultModelFor(kind: ProviderKind): string | null {
  return MODEL_CATALOG[kind][0]?.id ?? null;
}

/** Words that don't define a family, dropped so a model and its "preview"/"latest"
 *  alias collapse together (e.g. `gemini-pro` covers "Gemini 3.1 Pro Preview"). This
 *  is what lets MODEL_SHORTLIST_EXCLUDE then surgically drop the preview variant. */
const FAMILY_NOISE = new Set(['preview', 'latest']);

/** A model "line", ignoring version numbers: e.g. "Claude 3 Haiku" and
 *  "Claude Haiku 4.5" both reduce to `claude-haiku`. Derived from the label so the
 *  decimal versions ("4.5", "3.1") stay intact for `modelVersionOf`. */
export function modelFamilyKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/\d+(\.\d+)?/g, ' ') // drop version numbers wherever they sit
    .replace(/[^a-z]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((w) => w && !FAMILY_NOISE.has(w))
    .join('-');
}

/** Highest version number in a string (ignoring date/size-like values ≥ 100). */
function versionIn(text: string): number {
  const nums = (text.match(/\d+(\.\d+)?/g) ?? []).map(Number).filter((n) => n < 100);
  return nums.length ? Math.max(...nums) : 0;
}

/** A model's version for newest-of-family comparisons. The label is authoritative;
 *  when it carries no number (e.g. "Mistral Medium Latest") the id
 *  ("mistral-medium-3.5") is the fallback source. */
export function modelVersionOf(m: { id: string; label: string }): number {
  return versionIn(m.label) || versionIn(m.id);
}

/**
 * Default model shortlist, built in two stages:
 *
 *   1. MODEL_SHORTLIST: a hand-picked allowlist of model *families* per vendor.
 *      This decides which families show up at all. Versions are omitted (the
 *      newest member of a family wins) and so are "preview"/"latest" aliases
 *      (stripped by FAMILY_NOISE), so `gemini-pro` covers 2.5 Pro, 3 Pro
 *      Preview, etc., all one family.
 *   2. MODEL_SHORTLIST_EXCLUDE: substrings that drop individual variants *within*
 *      those families. Matched against `id` + `label`, so e.g. "preview" removes
 *      Gemini's preview builds, leaving the newest *stable* release as the
 *      family's latest.
 *
 * A model is in the shortlist when its family is allowlisted AND it isn't
 * excluded. Used by the picker's default table view and by the onboarding
 * default-model resolution, so both always agree on what "the latest Sonnet" is.
 * Keys are family keys as produced by `modelFamilyKey()`; exclude patterns are
 * plain case-insensitive substrings.
 */
export const MODEL_SHORTLIST: Partial<Record<ProviderKind, string[]>> = {
  [PROVIDER_KIND.ANTHROPIC]: ['claude-opus', 'claude-sonnet', 'claude-haiku'],
  [PROVIDER_KIND.GOOGLE]: ['gemini-pro', 'gemini-flash', 'gemini-flash-lite'],
  [PROVIDER_KIND.OPENAI]: ['gpt-pro', 'gpt', 'gpt-mini', 'gpt-nano'],
  // `mistral-ocr` only ever appears in the OCR picker (injected there), so listing
  // it here surfaces it by default without affecting the language-model picker.
  [PROVIDER_KIND.MISTRAL]: [
    'mistral-large',
    'pixtral-large',
    'mistral-medium',
    'mistral-small',
    'mistral-ocr',
  ],
};

export const MODEL_SHORTLIST_EXCLUDE: Partial<Record<ProviderKind, string[]>> = {
  [PROVIDER_KIND.GOOGLE]: ['preview'],
  // [PROVIDER_KIND.OPENAI]: ['codex'],
  // [PROVIDER_KIND.ANTHROPIC]: [],
  // [PROVIDER_KIND.MISTRAL]: [],
};

/** A model is buried by a MODEL_SHORTLIST_EXCLUDE substring (id or label). */
export function isShortlistExcluded(kind: ProviderKind, m: { id: string; label: string }): boolean {
  const patterns = MODEL_SHORTLIST_EXCLUDE[kind];
  if (!patterns?.length) return false;
  const hay = `${m.id} ${m.label}`.toLowerCase();
  return patterns.some((p) => hay.includes(p.toLowerCase()));
}

/**
 * Recommended out-of-the-box model *families* per cloud provider: a cheap & fast
 * tier for OCR, a mid tier for metadata extraction. No versions are pinned here.
 * `defaultModelSelection` resolves each family to its newest member from the live
 * model list, with the same family/version/exclusion rules the picker's table
 * uses. Keys are `modelFamilyKey()` outputs. Local (openai-compatible) endpoints
 * have no entry: their models are unknowable.
 */
export const DEFAULT_MODEL_FAMILIES: Partial<
  Record<ProviderKind, { ocr: string; extraction: string }>
> = {
  [PROVIDER_KIND.ANTHROPIC]: { ocr: 'claude-haiku', extraction: 'claude-sonnet' },
  [PROVIDER_KIND.OPENAI]: { ocr: 'gpt-mini', extraction: 'gpt' },
  [PROVIDER_KIND.GOOGLE]: { ocr: 'gemini-flash-lite', extraction: 'gemini-flash' },
  // Mistral OCR is a dedicated page-billed OCR product, the obvious OCR pick.
  [PROVIDER_KIND.MISTRAL]: { ocr: 'mistral-ocr', extraction: 'mistral-medium' },
};

/**
 * Settings patch that fills the *unset* pipeline model slots with defaults from
 * the highest-priority configured cloud provider (priority = CLOUD_PROVIDER_KINDS
 * order, the same order the API-keys table lists them in). Each slot's default
 * family resolves to its newest available version. Nothing is hardcoded, so new
 * model releases are picked up as soon as the catalog lists them. Slots the user
 * has already configured are never touched; returns null when there is nothing
 * to fill or no cloud provider is connected.
 *
 * `api` is the connected-credentials half of `AvailableModels` (`GET
 * /providers/models`), the same lists the picker renders.
 */
export function defaultModelSelection(
  api: readonly ProviderModels[],
  current: {
    ocrProviderId: number | null;
    ocrModel: string | null;
    llmProviderId: number | null;
    llmModel: string | null;
  },
): {
  ocrProviderId?: number;
  ocrModel?: string;
  llmProviderId?: number;
  llmModel?: string;
} | null {
  const group = CLOUD_PROVIDER_KINDS.flatMap((kind) => api.filter((g) => g.kind === kind))[0];
  const families = group && DEFAULT_MODEL_FAMILIES[group.kind];
  if (!group || !families) return null;

  const newestOf = (family: string, models: readonly ModelInfo[]): ModelInfo | null => {
    let best: ModelInfo | null = null;
    for (const m of models) {
      if (modelFamilyKey(m.label) !== family || isShortlistExcluded(group.kind, m)) continue;
      if (!best || modelVersionOf(m) > modelVersionOf(best)) best = m;
    }
    return best;
  };

  const patch: {
    ocrProviderId?: number;
    ocrModel?: string;
    llmProviderId?: number;
    llmModel?: string;
  } = {};
  if (current.ocrProviderId == null && current.ocrModel == null) {
    // OCR reads the page image, so only vision models qualify; dedicated OCR
    // models (e.g. Mistral OCR) are injected the same way the OCR picker does.
    const candidates = [...group.models.filter((m) => m.vision), ...(OCR_MODELS[group.kind] ?? [])];
    const model = newestOf(families.ocr, candidates);
    if (model) {
      patch.ocrProviderId = group.providerId;
      patch.ocrModel = model.id;
    }
  }
  if (current.llmProviderId == null && current.llmModel == null) {
    const model = newestOf(families.extraction, group.models);
    if (model) {
      patch.llmProviderId = group.providerId;
      patch.llmModel = model.id;
    }
  }
  return Object.keys(patch).length > 0 ? patch : null;
}
