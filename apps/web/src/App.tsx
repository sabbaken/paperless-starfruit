import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Boxes, Loader2, Plug, SlidersHorizontal } from 'lucide-react';
import { connectionApi } from './lib/api';
import { AppShell, type NavItem } from './components/app-shell';
import { ConnectScreen } from './screens/ConnectScreen';
import { ProvidersScreen } from './screens/ProvidersScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { ThemeToggle } from './components/theme-toggle';
import { Button } from './components/ui/button';

const NAV: NavItem[] = [
  { id: 'providers', label: 'Providers', icon: Boxes },
  { id: 'settings', label: 'Settings', icon: SlidersHorizontal },
  { id: 'connection', label: 'Connection', icon: Plug },
];

const META: Record<string, { title: string; description: string }> = {
  providers: { title: 'Providers', description: 'LLM & OCR connections and keys' },
  settings: { title: 'Settings', description: 'Processing behaviour & defaults' },
  connection: { title: 'Connection', description: 'Your paperless-ngx instance' },
};

export function App() {
  const status = useQuery({ queryKey: ['connection'], queryFn: connectionApi.get });
  const [view, setView] = useState('providers');

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

  // Onboarding gate: nothing else is reachable until paperless is connected.
  if (!status.data.connected) {
    return (
      <div className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between px-6 py-4">
          <span className="text-sm font-semibold tracking-tight">Paperless AI</span>
          <ThemeToggle />
        </header>
        <main className="flex flex-1 items-center justify-center px-6 pb-16">
          <ConnectScreen status={status.data} />
        </main>
      </div>
    );
  }

  const meta = META[view] ?? META.providers;

  return (
    <AppShell
      nav={NAV}
      active={view}
      onNavigate={setView}
      title={meta.title}
      description={meta.description}
      sidebarFooter={
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="size-2 shrink-0 rounded-full bg-emerald-500" />
          <span className="truncate">{status.data.baseUrl}</span>
        </div>
      }
    >
      {view === 'connection' ? (
        <ConnectScreen status={status.data} />
      ) : view === 'settings' ? (
        <SettingsScreen onGoToProviders={() => setView('providers')} />
      ) : (
        <ProvidersScreen />
      )}
    </AppShell>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        <span className="text-sm font-semibold tracking-tight">Paperless AI</span>
        <ThemeToggle />
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
