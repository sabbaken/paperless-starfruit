import { useCallback, useEffect } from 'react';
import type { Locale } from '@paperless-starfruit/shared';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectLanguage, setLanguage as setLanguageAction } from '@/store/settings.slice';

/** Read the active UI locale and update it (persisted via the settings slice). */
export function useLanguage() {
  const language = useAppSelector(selectLanguage);
  const dispatch = useAppDispatch();
  const setLanguage = useCallback((next: Locale) => dispatch(setLanguageAction(next)), [dispatch]);
  return { language, setLanguage };
}

/**
 * Keep `<html lang>` in sync with the active locale (mirrors `useThemeEffect`).
 * Mount once near the root.
 */
export function useLanguageEffect(): void {
  const language = useAppSelector(selectLanguage);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
}
