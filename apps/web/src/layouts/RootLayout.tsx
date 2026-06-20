import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { useConnection } from '@/api/connection';
import { Button } from '@/components/ui/button';
import { ConnectionPage } from '@/pages/ConnectionPage';

/**
 * Onboarding gate. Nothing else is reachable until paperless is connected:
 * while the status loads we show a spinner, on failure an unreachable notice,
 * and when disconnected the connection form. Only once connected do the routed
 * pages (its `children`) render.
 */
export function RootLayout({ children }: { children: ReactNode }) {
  const status = useConnection();

  if (status.isError) {
    return (
      <Centered>
        <Unreachable
          message={status.error instanceof Error ? status.error.message : 'unknown error'}
          onRetry={() => void status.refetch()}
          retrying={status.isFetching}
        />
      </Centered>
    );
  }

  if (status.isLoading || !status.data) {
    return (
      <Centered>
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Loading" />
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
      <header className="flex items-center px-6 py-4">
        <span className="text-sm font-semibold tracking-tight">Paperless AI</span>
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
  return (
    <div className="w-full max-w-sm space-y-4 text-center">
      <div className="space-y-1.5">
        <p className="font-medium">Backend unreachable</p>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
      <Button variant="outline" onClick={onRetry} disabled={retrying}>
        {retrying && <Loader2 className="animate-spin" />}
        {retrying ? 'Retrying…' : 'Retry'}
      </Button>
    </div>
  );
}
