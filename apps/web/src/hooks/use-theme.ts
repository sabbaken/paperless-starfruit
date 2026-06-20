import { useCallback, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectTheme, setTheme as setThemeAction, type Theme } from '@/store/settings.slice';

/** Read the active theme and update it (persisted via the settings slice). */
export function useTheme() {
  const theme = useAppSelector(selectTheme);
  const dispatch = useAppDispatch();
  const setTheme = useCallback((next: Theme) => dispatch(setThemeAction(next)), [dispatch]);
  return { theme, setTheme };
}

/**
 * Apply the active theme to the document: toggles the `dark` class on <html> and,
 * while on `system`, follows the OS color-scheme preference. Mount once near the root.
 */
export function useThemeEffect(): void {
  const theme = useAppSelector(selectTheme);

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const dark =
        theme === 'dark' ||
        (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      root.classList.toggle('dark', dark);
    };
    apply();

    if (theme !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
}
