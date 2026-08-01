import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import {
  ChevronRight,
  Coffee,
  History,
  Inbox,
  LayoutDashboard,
  LogOut,
  SlidersHorizontal,
  Tags,
} from 'lucide-react';
import { useConnection } from '@/api/connection';
import { useLogout } from '@/api/auth';
import { useStats } from '@/api/stats';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectSidebarOpen, setSidebarOpen } from '@/store/settings.slice';
import { cn } from '@/lib/utils';
import { ACTIVE_NAV_ITEM } from '@/lib/nav';
import { UpdateNotice } from '@/components/update-notice';
import { useTranslation } from '@/i18n/I18nProvider';
import type { TFunction } from '@paperless-starfruit/shared';
import type { NavItem } from '@/types/nav';

const buildMeta = (
  t: TFunction,
): Record<string, { title: string; description: string; width?: 'narrow' | 'wide' }> => ({
  '/dashboard': {
    title: t('nav.meta.dashboard.title'),
    description: t('nav.meta.dashboard.description'),
    width: 'wide',
  },
  '/review': {
    title: t('nav.meta.review.title'),
    description: t('nav.meta.review.description'),
    width: 'wide',
  },
  '/history': {
    title: t('nav.meta.history.title'),
    description: t('nav.meta.history.description'),
    width: 'wide',
  },
  '/tags': {
    title: t('nav.meta.tags.title'),
    description: t('nav.meta.tags.description'),
    width: 'wide',
  },
  '/settings/general': {
    title: t('nav.meta.general.title'),
    description: t('nav.meta.general.description'),
  },
  '/settings/connection': {
    title: t('nav.meta.connection.title'),
    description: t('nav.meta.connection.description'),
  },
  '/settings/api-keys': {
    title: t('nav.meta.apiKeys.title'),
    description: t('nav.meta.apiKeys.description'),
  },
  '/settings/processing': {
    title: t('nav.meta.processing.title'),
    description: t('nav.meta.processing.description'),
  },
  '/settings/prompts': {
    title: t('nav.meta.prompts.title'),
    description: t('nav.meta.prompts.description'),
    width: 'wide',
  },
});

/** The GitHub mark, inlined (lucide dropped its brand icons). Sized by the menu button's svg styles. */
function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

/** The connected app chrome: shadcn sidebar nav + page header. Wraps the routed pages. */
export function DashboardLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const connection = useConnection();
  // Drives the live "pending review" badge in the nav; cheap and always-on.
  const stats = useStats({ refetchInterval: 8000 });
  // Sidebar expanded/collapsed state lives in the persisted settings slice, so it
  // survives reloads (the component's built-in cookie is never read in this SPA).
  const sidebarOpen = useAppSelector(selectSidebarOpen);
  const dispatch = useAppDispatch();
  const logout = useLogout();

  const metaMap = buildMeta(t);
  const meta = metaMap[pathname] ?? metaMap['/dashboard'];
  const width = meta.width ?? 'narrow';
  const conn = connection.data;
  const baseUrl = conn && conn.connected ? conn.baseUrl : null;

  const nav: NavItem[] = [
    { to: '/dashboard', label: t('nav.labels.dashboard'), icon: LayoutDashboard },
    { to: '/review', label: t('nav.labels.review'), icon: Inbox, badge: stats.data?.pendingReview },
    { to: '/history', label: t('nav.labels.history'), icon: History },
    { to: '/tags', label: t('nav.labels.tags'), icon: Tags },
    {
      to: '/settings',
      label: t('nav.labels.settings'),
      icon: SlidersHorizontal,
      defaultOpen: true,
      children: [
        { to: '/settings/general', label: t('nav.labels.general') },
        { to: '/settings/processing', label: t('nav.labels.processing') },
        { to: '/settings/prompts', label: t('nav.labels.prompts') },
        { to: '/settings/api-keys', label: t('nav.labels.apiKeys') },
        { to: '/settings/connection', label: t('nav.labels.connection') },
      ],
    },
  ];

  return (
    <SidebarProvider
      className="h-svh"
      open={sidebarOpen}
      onOpenChange={(open) => dispatch(setSidebarOpen(open))}
    >
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex h-8 items-center gap-2 px-1">
            <img src="/paperless-starfruit.png" alt="" className="size-5 shrink-0" />
            {/* nowrap: during the collapse animation the header narrows and the
                two-word name would flicker onto two lines. */}
            <span className="text-sm font-semibold tracking-tight whitespace-nowrap group-data-[collapsible=icon]:hidden">
              Paperless Starfruit
            </span>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {nav.map((item) => {
                  // A parent with children is a collapsible section, handled by NavGroup:
                  // the row navigates to the first child, the chevron toggles the sub-list.
                  if (item.children) {
                    return <NavGroup key={item.to} item={item} pathname={pathname} />;
                  }

                  const Icon = item.icon;
                  const active = item.to === pathname;
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.label}
                        className={ACTIVE_NAV_ITEM}
                      >
                        <Link to={item.to} aria-current={active ? 'page' : undefined}>
                          <Icon />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                      {item.badge ? (
                        <SidebarMenuBadge className="bg-brand text-brand-foreground">
                          {item.badge}
                        </SidebarMenuBadge>
                      ) : null}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <UpdateNotice />
          <SidebarMenu>
            {baseUrl && (
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip={t('nav.footer.openPaperless')}>
                  <a href={baseUrl} target="_blank" rel="noreferrer">
                    {/* The status dot keeps its size but sits in an icon-sized box,
                        so the label lines up with the other footer items. */}
                    <span className="flex size-4 shrink-0 items-center justify-center">
                      <span className="size-2 rounded-full bg-emerald-500" />
                    </span>
                    <span>{baseUrl}</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="GitHub">
                <a
                  href="https://github.com/sabbaken/paperless-starfruit"
                  target="_blank"
                  rel="noreferrer"
                >
                  <GithubIcon />
                  <span>GitHub</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip={t('nav.footer.supportKofi')}>
                <a href="https://ko-fi.com/sabbaken" target="_blank" rel="noreferrer">
                  <Coffee />
                  <span>{t('nav.footer.supportKofi')}</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              {/* The only footer item that's a real <button> (the rest are links,
                  which get the pointer for free). The vendored SidebarMenuButton
                  doesn't set a cursor itself. */}
              <SidebarMenuButton
                onClick={logout}
                tooltip={t('nav.footer.signOut')}
                className="cursor-pointer"
              >
                <LogOut />
                <span>{t('nav.footer.signOut')}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold tracking-tight">{meta.title}</h1>
            {meta.description && (
              <p className="truncate text-xs text-muted-foreground">{meta.description}</p>
            )}
          </div>
        </header>

        {/* A flex column all the way down, so a page can flex-1 itself to
            vertically center sparse content (e.g. an empty state). */}
        <div className="flex flex-1 flex-col px-6 py-8">
          <div
            className={cn(
              'mx-auto flex w-full flex-1 flex-col',
              width === 'wide' ? 'max-w-5xl' : 'max-w-3xl',
            )}
          >
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

/**
 * A collapsible nav section (a parent item with children). The row itself is a link
 * that always navigates to the first child and expands the group; the chevron is a
 * separate action that toggles the sub-list independently.
 */
function NavGroup({ item, pathname }: { item: NavItem; pathname: string }) {
  const { t } = useTranslation();
  const Icon = item.icon;
  const children = item.children ?? [];
  const sectionActive =
    item.to === pathname ||
    children.some((c) => c.to === pathname) ||
    pathname.startsWith(`${item.to}/`);
  const [open, setOpen] = useState(item.defaultOpen || sectionActive);
  const firstChild = children[0]?.to ?? item.to;

  // The sub-items only render when the group is expanded AND the sidebar isn't collapsed to
  // icons (the mobile sheet always shows full-width content, so icon-collapse never hides them
  // there). Highlight the parent only when its active child is hidden. When the child is
  // visible it already carries the active marker, so lighting up the parent too is redundant.
  const { state, isMobile } = useSidebar();
  const childrenVisible = open && (isMobile || state === 'expanded');
  const highlightParent = sectionActive && !childrenVisible;

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild className="group/collapsible">
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          isActive={highlightParent}
          tooltip={item.label}
          className={ACTIVE_NAV_ITEM}
        >
          <Link
            to={firstChild}
            onClick={(e) => {
              if (open) {
                // Already expanded → a second click collapses instead of navigating.
                e.preventDefault();
                setOpen(false);
              } else {
                setOpen(true);
              }
            }}
          >
            <Icon />
            <span>{item.label}</span>
          </Link>
        </SidebarMenuButton>
        <CollapsibleTrigger asChild>
          <SidebarMenuAction
            aria-label={t('nav.toggle', { label: item.label })}
            className="cursor-pointer data-[state=open]:rotate-90"
          >
            <ChevronRight />
          </SidebarMenuAction>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {children.map((child) => (
              <SidebarMenuSubItem key={child.to}>
                <SidebarMenuSubButton
                  asChild
                  isActive={child.to === pathname}
                  className={ACTIVE_NAV_ITEM}
                >
                  <Link to={child.to} aria-current={child.to === pathname ? 'page' : undefined}>
                    <span>{child.label}</span>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}
