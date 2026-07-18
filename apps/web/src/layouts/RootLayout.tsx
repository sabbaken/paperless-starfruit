import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { useConnection } from '@/api/connection';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/I18nProvider';
import { ConnectionPage } from '@/pages/ConnectionPage';

/**
 * Onboarding gate. Nothing else is reachable until paperless is connected:
 * while the status loads we show a spinner, on failure an unreachable notice,
 * and when disconnected the connection form. Only once connected do the routed
 * pages (its `children`) render.
 */
export function RootLayout({ children }: { children: ReactNode }) {
  const status = useConnection();
  const { t } = useTranslation();

  if (status.isError) {
    return (
      <Centered>
        <Unreachable
          message={status.error instanceof Error ? status.error.message : t('app.unknownError')}
          onRetry={() => void status.refetch()}
          retrying={status.isFetching}
        />
      </Centered>
    );
  }

  if (status.isLoading || !status.data) {
    return (
      <Centered>
        <Loader2
          className="size-5 animate-spin text-muted-foreground"
          aria-label={t('app.loadingLabel')}
        />
      </Centered>
    );
  }

  if (!status.data.connected) {
    return (
      <Centered>
        <ConnectionPage />
      </Centered>
    );
  }

  return <>{children}</>;
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center gap-2 px-6 py-4">
        <img src="/paperless-starfruit.png" alt="" className="size-5 shrink-0" />
        <span className="text-sm font-semibold tracking-tight">Paperless Starfruit</span>
      </header>
      <main className="flex flex-1 items-center justify-center px-6 pb-16">{children}</main>
    </div>
  );
}

function Unreachable({
  message,
  onRetry,
  retrying,
}: {
  message: string;
  onRetry: () => void;
  retrying: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="w-full max-w-sm space-y-4 text-center">
      <div className="space-y-1.5">
        <p className="font-medium">{t('app.backendUnreachable')}</p>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
      <Button variant="outline" onClick={onRetry} disabled={retrying}>
        {retrying && <Loader2 className="animate-spin" />}
        {retrying ? t('common.retrying') : t('common.retry')}
      </Button>
    </div>
  );
}
