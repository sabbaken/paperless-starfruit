import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { Provider as ReduxProvider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { queryClient } from '@/api/query-client';
import { useLanguageEffect } from '@/hooks/use-language';
import { useThemeEffect } from '@/hooks/use-theme';
import { I18nProvider } from '@/i18n/I18nProvider';
import { persistor, store } from '@/store';

/** Applies the persisted theme to <html>; renders nothing. */
function ThemeEffect() {
  useThemeEffect();
  return null;
}

/** Keeps `<html lang>` in sync with the persisted locale; renders nothing. */
function LanguageEffect() {
  useLanguageEffect();
  return null;
}

/** App-wide context providers (Redux store + persisted theme/locale + React Query). */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ReduxProvider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <ThemeEffect />
        <LanguageEffect />
        <I18nProvider>
          <QueryClientProvider client={queryClient}>
            {children}
            <Toaster
              position="bottom-right"
              toastOptions={{
                className: 'text-sm',
                style: {
                  background: 'var(--popover)',
                  color: 'var(--popover-foreground)',
                  border: '1px solid var(--border)',
                },
              }}
            />
          </QueryClientProvider>
        </I18nProvider>
      </PersistGate>
    </ReduxProvider>
  );
}
