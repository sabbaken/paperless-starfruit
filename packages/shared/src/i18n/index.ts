import { en } from './locales/en';
import { ru } from './locales/ru';
import type { Messages, MessageKey, TFunction, TVars } from './types';

export type { Messages, MessageKey, TFunction, TVars } from './types';
export { en } from './locales/en';
export { ru } from './locales/ru';

/**
 * Every bundled dictionary, keyed by locale code. English is the contract that
 * `Messages` is derived from; adding a locale is `{ en, ru }` with `ru` typed
 * `satisfies Messages`, which forces it to cover every key.
 */
export const dictionaries = { en, ru } satisfies Record<string, Messages>;

/** Canonical locale codes — the single source shared by web state and the site. */
export type Locale = keyof typeof dictionaries;

/** The default/fallback locale. Missing keys in any locale fall back through here. */
export const DEFAULT_LOCALE: Locale = 'en';

/** Presentation metadata for the language picker. */
export interface LocaleMeta {
  code: Locale;
  /** Native language name — the real identifier shown to the user (D6). */
  label: string;
  /** Cosmetic flag emoji only; ambiguous for some languages, so never the identifier. */
  flag: string;
}

/**
 * The languages offered in the UI, in menu order. Native `label` is the
 * identifier; `flag` is decorative. Add an entry here when adding a locale.
 */
export const LOCALES: ReadonlyArray<LocaleMeta> = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
];

/** Walk a dot-path against a dictionary; returns the leaf string or `undefined`. */
function lookup(dict: Messages, key: string): string | undefined {
  let node: unknown = dict;
  for (const part of key.split('.')) {
    if (node && typeof node === 'object' && part in node) {
      node = (node as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof node === 'string' ? node : undefined;
}

/** Replace `{{var}}` placeholders; an unknown placeholder is left untouched. */
function interpolate(template: string, vars: TVars): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

/**
 * Build a translate function bound to a locale. Falls back to English, then to the
 * raw key, so a missing translation degrades to readable English rather than a crash.
 */
export function createT(locale: Locale): TFunction {
  const dict = dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
  return (key: MessageKey, vars?: TVars): string => {
    const raw = lookup(dict, key) ?? lookup(dictionaries[DEFAULT_LOCALE], key) ?? key;
    return vars ? interpolate(raw, vars) : raw;
  };
}
