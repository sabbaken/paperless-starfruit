import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { createT, DEFAULT_LOCALE, type Locale, type TFunction } from '@paperless-starfruit/shared';
import { useLanguage } from '@/hooks/use-language';

interface I18nContextValue {
  /** Translate a dot-path key, with optional `{{var}}` interpolation. */
  t: TFunction;
  /** The active UI locale. */
  language: Locale;
  /** Switch the UI locale (persisted). */
  setLanguage: (locale: Locale) => void;
}

// Default degrades to English so a stray `useTranslation` outside the provider
// still returns readable copy instead of throwing.
const I18nContext = createContext<I18nContextValue>({
  t: createT(DEFAULT_LOCALE),
  language: DEFAULT_LOCALE,
  setLanguage: () => {},
});

/** Provides the memoized `t` bound to the persisted locale to the whole app. */
export function I18nProvider({ children }: { children: ReactNode }) {
  const { language, setLanguage } = useLanguage();
  const value = useMemo<I18nContextValue>(
    () => ({ t: createT(language), language, setLanguage }),
    [language, setLanguage],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Access the translate function and current locale. */
export function useTranslation(): I18nContextValue {
  return useContext(I18nContext);
}
