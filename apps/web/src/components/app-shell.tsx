import type { LucideIcon } from 'lucide-react';
import { FileStack } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { ThemeToggle } from './theme-toggle';

export interface SubNavItem {
  /** Route path this item navigates to. */
  to: string;
  label: string;
}

export interface NavItem {
  /** Route path this item navigates to (the parent of a section may redirect). */
  to: string;
  label: string;
  icon: LucideIcon;
  /** Optional count pill (e.g. pending review backlog); hidden when 0. */
  badge?: number;
  /** Nested destinations shown beneath this item when its section is active. */
  children?: SubNavItem[];
}

interface AppShellProps {
  nav: NavItem[];
  /** Current route pathname, used to highlight the active item. */
  activePath: string;
  onNavigate: (to: string) => void;
  title: string;
  description?: string;
  /** Content max-width: 'narrow' for forms, 'wide' for tables/side-by-side. */
  width?: 'narrow' | 'wide';
  /** Small status block pinned to the bottom of the sidebar. */
  sidebarFooter?: ReactNode;
  children: ReactNode;
}

export function AppShell({
  nav,
  activePath,
  onNavigate,
  title,
  description,
  width = 'narrow',
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
            const childPaths = item.children?.map((c) => c.to) ?? [];
            // A parent with children is a section header, not a destination of
            // its own; clicking it opens its first child.
            const sectionActive =
              item.to === activePath ||
              childPaths.includes(activePath) ||
              activePath.startsWith(`${item.to}/`);
            const leafActive = !item.children && item.to === activePath;
            const target = item.children?.[0]?.to ?? item.to;
            return (
              <Fragment key={item.to}>
                <button
                  type="button"
                  onClick={() => onNavigate(target)}
                  aria-current={item.to === activePath ? 'page' : undefined}
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
                        onClick={() => onNavigate(child.to)}
                        aria-current={child.to === activePath ? 'page' : undefined}
                        className={cn(
                          'rounded-md px-2.5 py-1.5 text-left text-sm transition-colors',
                          child.to === activePath
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
          <div className={cn('mx-auto w-full', width === 'wide' ? 'max-w-5xl' : 'max-w-3xl')}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
