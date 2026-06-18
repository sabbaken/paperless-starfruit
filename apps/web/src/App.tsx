import { useQuery } from '@tanstack/react-query';
import { connectionApi } from './lib/api';
import { ConnectScreen } from './screens/ConnectScreen';
import { Button } from './components/ui';

export function App() {
  const status = useQuery({
    queryKey: ['connection'],
    queryFn: connectionApi.get,
  });

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      {status.isError ? (
        <Unreachable
          message={status.error instanceof Error ? status.error.message : 'unknown error'}
          onRetry={() => void status.refetch()}
          retrying={status.isFetching}
        />
      ) : status.isLoading || !status.data ? (
        <Booting />
      ) : (
        <ConnectScreen status={status.data} />
      )}
    </main>
  );
}

function Booting() {
  return (
    <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.22em] text-paper-faint">
      <span className="h-2 w-2 animate-pulse rounded-full bg-warn" />
      initializing
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
      <div className="flex items-center justify-center gap-2 font-mono text-xs uppercase tracking-[0.22em] text-alert">
        <span className="h-2 w-2 rounded-full bg-alert" />
        backend unreachable
      </div>
      <p className="font-mono text-xs text-paper-dim">{message}</p>
      <Button variant="ghost" onClick={onRetry} disabled={retrying}>
        {retrying ? 'Retrying…' : 'Retry'}
      </Button>
    </div>
  );
}
