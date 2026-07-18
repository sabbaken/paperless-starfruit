import type { en } from './locales/en';

/**
 * The English dictionary's shape is the translation contract. Every other locale
 * is checked against `Messages` (via `satisfies`), so a missing or renamed key is
 * a compile error at the locale's definition, not a runtime `undefined`.
 */
export type Messages = typeof en;

/**
 * Dot-path union of every leaf key in the dictionary
 * (`"common.save" | "general.theme" | …`). This is what `t()` accepts, so a typo
 * like `t('common.svae')` fails to compile.
 */
export type MessageKey<T = Messages> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${MessageKey<T[K]>}`;
}[keyof T & string];

/** Values interpolated into `{{var}}` placeholders. Numbers are stringified. */
export type TVars = Record<string, string | number>;

/** The translate function returned by {@link createT}. */
export type TFunction = (key: MessageKey, vars?: TVars) => string;
