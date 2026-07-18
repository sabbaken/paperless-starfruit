import { createT, DEFAULT_LOCALE, type TFunction } from '@paperless-starfruit/shared';

// Non-React code (toast helpers, etc.) can't use the `useTranslation` hook, but
// still needs locale-aware copy. This module mirrors the active `t`; the
// I18nProvider keeps it in sync with the persisted locale on every change.
let current: TFunction = createT(DEFAULT_LOCALE);

/** Point the out-of-React translator at the active locale. Called by I18nProvider. */
export function setActiveT(t: TFunction): void {
  current = t;
}

/** The translate function for the active locale, for use outside React components. */
export function getT(): TFunction {
  return current;
}
