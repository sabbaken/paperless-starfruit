import type { en } from './locales/en';

/**
 * Recursively widen the literal types `en`'s `as const` captures (`'Save'`) back
 * to their base types (`string`), preserving the object shape. Without this the
 * contract would demand the *exact English text* in every locale, so a
 * translation like `save: 'Сохранить'` wouldn't type-check.
 */
type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };

/**
 * The English dictionary's shape is the translation contract: which keys exist
 * and how they nest. Every other locale is checked against `Messages` (via
 * `satisfies`), so a missing or renamed key is a compile error at the locale's
 * definition, not a runtime `undefined`. Only the shape is enforced — the leaf
 * values are free-form `string` so each locale supplies its own translation.
 */
export type Messages = Widen<typeof en>;

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
