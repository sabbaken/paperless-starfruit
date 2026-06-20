import { Fragment, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FileStack, Inbox, LayoutDashboard, SlidersHorizontal } from 'lucide-react';
import { useConnection } from '@/api/connection';
import { useStats } from '@/api/stats';
import { ThemeToggle } from '@/components/theme-toggle';
import { cn } from '@/lib/utils';
import type { NavItem } from '@/types/nav';

const META: Record<string, { title: string; description: string; width?: 'narrow' | 'wide' }> = {
  '/dashboard': { title: 'Dashboard', description: 'Queue, throughput and recent activity', width: 'wide' },
  '/review': { title: 'Review queue', description: 'Approve, edit or reject AI suggestions', width: 'wide' },
  '/settings/connection': { title: 'Connection', description: 'Your paperless-ngx instance' },
  '/settings/api-keys': { title: 'API Keys', description: 'Connect AI providers' },
  '/settings/processing': { title: 'Processing', description: 'Models & how documents are enriched' },
};

/** The connected app chrome: sidebar nav + page header. Wraps the routed pages. */
export function DashboardLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const connection = useConnection();
  // Drives the live "pending review" badge in the nav; cheap and always-on.
  const stats = useStats({ refetchInterval: 8000 });

  const meta = META[pathname] ?? META['/dashboard'];
  const width = meta.width ?? 'narrow';
  const conn = connection.data;
  const baseUrl = conn && conn.connected ? conn.baseUrl : null;

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
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col border-r bg-card/40">
        <div className="flex h-14 items-center gap-2 px-5">
          <FileStack className="size-5 text-primary" />
          <span className="text-sm font-semibold tracking-tight">Paperless AI</span>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 px-3 py-2">
          {nav.map((item) => {
            const Icon = item.icon;
            const childPaths = item.children?.map((c) => c.to) ?? [];
            // A parent with children is a section header, not a destination of
            // its own; clicking it opens its first child.
            const sectionActive =
              item.to === pathname ||
              childPaths.includes(pathname) ||
              pathname.startsWith(`${item.to}/`);
            const leafActive = !item.children && item.to === pathname;
            const target = item.children?.[0]?.to ?? item.to;
            return (
              <Fragment key={item.to}>
                <button
                  type="button"
                  onClick={() => navigate(target)}
                  aria-current={item.to === pathname ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    leafActive
                      ? 'bg-accent text-accent-foreground'
                      : sectionActive
                        ? 'text-foreground'
                        : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {item.badge ? (
                    <span className="rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground tabular-nums">
                      {item.badge}
                    </span>
                  ) : null}
                </button>

                {item.children && sectionActive && (
                  <div className="my-0.5 ml-4 flex flex-col gap-0.5 border-l pl-3">
                    {item.children.map((child) => (
                      <button
                        key={child.to}
                        type="button"
                        onClick={() => navigate(child.to)}
                        aria-current={child.to === pathname ? 'page' : undefined}
                        className={cn(
                          'rounded-md px-2.5 py-1.5 text-left text-sm transition-colors',
                          child.to === pathname
                            ? 'bg-accent font-medium text-accent-foreground'
                            : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                        )}
                      >
                        {child.label}
                      </button>
                    ))}
                  </div>
                )}
              </Fragment>
            );
          })}
        </nav>

        {baseUrl && (
          <div className="border-t px-4 py-3 text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="size-2 shrink-0 rounded-full bg-emerald-500" />
              <span className="truncate">{baseUrl}</span>
            </div>
          </div>
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-4 border-b px-6">
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold tracking-tight">{meta.title}</h1>
            {meta.description && (
              <p className="truncate text-xs text-muted-foreground">{meta.description}</p>
            )}
          </div>
          <ThemeToggle />
        </header>

        <main className="flex-1 overflow-y-auto px-6 py-8">
          <div className={cn('mx-auto w-full', width === 'wide' ? 'max-w-5xl' : 'max-w-3xl')}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
