import { useQuery } from '@tanstack/react-query';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Inbox, LayoutDashboard, Loader2, SlidersHorizontal } from 'lucide-react';
import { connectionApi, statsApi } from './lib/api';
import { MainLayout, type NavItem } from './layouts/main-layout';
import { ConnectScreen } from './screens/ConnectScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { ReviewScreen } from './screens/ReviewScreen';
import { ApiKeysScreen } from './screens/ApiKeysScreen';
import { ProcessingSettings } from './screens/ProcessingSettings';
import { ThemeToggle } from './components/theme-toggle';
import { Button } from './components/ui/button';

const META: Record<string, { title: string; description: string; width?: 'narrow' | 'wide' }> = {
  '/dashboard': { title: 'Dashboard', description: 'Queue, throughput and recent activity', width: 'wide' },
  '/review': { title: 'Review queue', description: 'Approve, edit or reject AI suggestions', width: 'wide' },
  '/settings/connection': { title: 'Connection', description: 'Your paperless-ngx instance' },
  '/settings/api-keys': { title: 'API Keys', description: 'Connect AI providers' },
  '/settings/processing': { title: 'Processing', description: 'Models & how documents are enriched' },
};

export function App() {
  const status = useQuery({ queryKey: ['connection'], queryFn: connectionApi.get });
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // Drives the live "pending review" badge in the nav; cheap and always-on.
  const stats = useQuery({
    queryKey: ['stats'],
    queryFn: statsApi.get,
    enabled: status.data?.connected === true,
    refetchInterval: 8000,
  });

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

  const connected = status.data;
  const meta = META[pathname] ?? META['/dashboard'];
  const nav: NavItem[] = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/review', label: 'Review', icon: Inbox, badge: stats.data?.pendingReview },
    {
      to: '/settings',
      label: 'Settings',
      icon: SlidersHorizontal,
      children: [
        { to: '/settings/processing', label: 'Processing' },
        { to: '/settings/api-keys', label: 'API Keys' },
        { to: '/settings/connection', label: 'Connection' },
      ],
    },
  ];

  return (
    <MainLayout
      nav={nav}
      activePath={pathname}
      onNavigate={(to) => navigate(to)}
      title={meta.title}
      description={meta.description}
      width={meta.width}
      sidebarFooter={
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="size-2 shrink-0 rounded-full bg-emerald-500" />
          <span className="truncate">{connected.baseUrl}</span>
        </div>
      }
    >
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardScreen onReview={() => navigate('/review')} />} />
        <Route path="/review" element={<ReviewScreen />} />
        <Route path="/settings" element={<Navigate to="/settings/connection" replace />} />
        <Route path="/settings/connection" element={<ConnectScreen status={connected} />} />
        <Route path="/settings/api-keys" element={<ApiKeysScreen />} />
        <Route
          path="/settings/processing"
          element={<ProcessingSettings onGoToProviders={() => navigate('/settings/api-keys')} />}
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </MainLayout>
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
