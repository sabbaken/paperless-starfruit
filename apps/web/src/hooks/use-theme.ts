import { useCallback, useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectTheme, setTheme as setThemeAction, type Theme } from '@/store/settings.slice';

/** Read the active theme and update it (persisted via the settings slice). */
export function useTheme() {
  const theme = useAppSelector(selectTheme);
  const dispatch = useAppDispatch();
  const setTheme = useCallback((next: Theme) => dispatch(setThemeAction(next)), [dispatch]);
  return { theme, setTheme };
}

type WithViewTransition = Document & {
  startViewTransition?: (callback: () => void) => unknown;
};

/**
 * Apply the active theme to the document: toggles the `dark` class on <html> and,
 * while on `system`, follows the OS color-scheme preference. Mount once near the root.
 *
 * The first application (page load) is instant; later switches are wrapped in a View
 * Transition so the colours cross-fade instead of snapping (styled in index.css). Falls
 * back to an instant swap when the API is unavailable or the user prefers reduced motion.
 */
export function useThemeEffect(): void {
  const theme = useAppSelector(selectTheme);
  const firstRun = useRef(true);

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const dark =
        theme === 'dark' ||
        (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      root.classList.toggle('dark', dark);
    };

    const applyAnimated = () => {
      const doc = document as WithViewTransition;
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (firstRun.current || reduceMotion || typeof doc.startViewTransition !== 'function') {
        apply();
      } else {
        doc.startViewTransition(apply);
      }
      firstRun.current = false;
    };

    applyAnimated();

    if (theme !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', applyAnimated);
    return () => media.removeEventListener('change', applyAnimated);
  }, [theme]);
}
