import { useQuery } from '@tanstack/react-query';

interface Health {
  status: string;
}

export function App() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['health'],
    queryFn: async (): Promise<Health> => {
      const res = await fetch('/api/health');
      if (!res.ok) throw new Error('request failed');
      return res.json() as Promise<Health>;
    },
    refetchInterval: 10_000,
  });

  const apiState = isLoading
    ? 'checking…'
    : isError
      ? 'unreachable'
      : (data?.status ?? 'unknown');

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-100">
      <div className="space-y-3 text-center">
        <h1 className="text-2xl font-semibold">Paperless AI</h1>
        <p className="text-sm text-zinc-400">
          API status: <span className="font-mono">{apiState}</span>
        </p>
      </div>
    </main>
  );
}
