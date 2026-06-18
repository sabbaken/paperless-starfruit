import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { connectionApi } from './lib/api';
import { ConnectScreen } from './screens/ConnectScreen';
import { ThemeToggle } from './components/theme-toggle';
import { Button } from './components/ui/button';

export function App() {
  const status = useQuery({
    queryKey: ['connection'],
    queryFn: connectionApi.get,
  });

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        <span className="text-sm font-semibold tracking-tight">Paperless AI</span>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center px-6 pb-16">
        {status.isError ? (
          <Unreachable
            message={status.error instanceof Error ? status.error.message : 'unknown error'}
            onRetry={() => void status.refetch()}
            retrying={status.isFetching}
          />
        ) : status.isLoading || !status.data ? (
          <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Loading" />
        ) : (
          <ConnectScreen status={status.data} />
        )}
      </main>
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
