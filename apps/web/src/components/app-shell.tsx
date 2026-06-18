import type { LucideIcon } from 'lucide-react';
import { FileStack } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import { ThemeToggle } from './theme-toggle';

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface AppShellProps {
  nav: NavItem[];
  active: string;
  onNavigate: (id: string) => void;
  title: string;
  description?: string;
  /** Small status block pinned to the bottom of the sidebar. */
  sidebarFooter?: ReactNode;
  children: ReactNode;
}

export function AppShell({
  nav,
  active,
  onNavigate,
  title,
  description,
  sidebarFooter,
  children,
}: AppShellProps) {
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
            const isActive = item.id === active;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                )}
              >
                <Icon className="size-4 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>

        {sidebarFooter && <div className="border-t px-4 py-3 text-xs">{sidebarFooter}</div>}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-4 border-b px-6">
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold tracking-tight">{title}</h1>
            {description && (
              <p className="truncate text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          <ThemeToggle />
        </header>

        <main className="flex-1 overflow-y-auto px-6 py-8">
          <div className="mx-auto w-full max-w-3xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
