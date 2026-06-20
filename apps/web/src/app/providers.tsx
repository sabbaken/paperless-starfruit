import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { Provider as ReduxProvider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { queryClient } from "@/api/query-client";
import { useThemeEffect } from "@/hooks/use-theme";
import { persistor, store } from "@/store";

/** Applies the persisted theme to <html>; renders nothing. */
function ThemeEffect() {
  useThemeEffect();
  return null;
}

/** App-wide context providers (Redux store + persisted theme + React Query). */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ReduxProvider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <ThemeEffect />
        <QueryClientProvider client={queryClient}>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              className: "text-sm",
              style: {
                background: "var(--popover)",
                color: "var(--popover-foreground)",
                border: "1px solid var(--border)",
              },
            }}
          />
        </QueryClientProvider>
      </PersistGate>
    </ReduxProvider>
  );
}
