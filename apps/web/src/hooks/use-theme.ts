import { useContext } from 'react';
import { ThemeProviderContext, type ThemeProviderState } from '@/components/theme-provider';

/** Read/update the active theme from anywhere under {@link ThemeProvider}. */
export function useTheme(): ThemeProviderState {
  return useContext(ThemeProviderContext);
}
