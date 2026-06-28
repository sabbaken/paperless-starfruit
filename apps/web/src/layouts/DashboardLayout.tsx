import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Coffee, History, Inbox, LayoutDashboard, LogOut, SlidersHorizontal } from 'lucide-react';
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
import type { NavItem } from '@/types/nav';

const META: Record<string, { title: string; description: string; width?: 'narrow' | 'wide' }> = {
  '/dashboard': { title: 'Dashboard', description: 'Queue, throughput and recent activity', width: 'wide' },
  '/review': { title: 'Review queue', description: 'Approve, edit or reject AI suggestions', width: 'wide' },
  '/history': { title: 'History', description: 'Inspect the prompts and model responses behind each run', width: 'wide' },
  '/settings/general': { title: 'General', description: 'Theme and app preferences' },
  '/settings/connection': { title: 'Connection', description: 'Your paperless-ngx instance' },
  '/settings/api-keys': { title: 'API Keys', description: 'Connect AI providers' },
  '/settings/processing': { title: 'Processing', description: 'Models & how documents are enriched' },
  '/settings/prompts': { title: 'Prompts', description: 'Customise what each model is asked', width: 'wide' },
};

/** The connected app chrome: shadcn sidebar nav + page header. Wraps the routed pages. */
export function DashboardLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const connection = useConnection();
  // Drives the live "pending review" badge in the nav; cheap and always-on.
  const stats = useStats({ refetchInterval: 8000 });
  // Sidebar expanded/collapsed state lives in the persisted settings slice, so it
  // survives reloads (the component's built-in cookie is never read in this SPA).
  const sidebarOpen = useAppSelector(selectSidebarOpen);
  const dispatch = useAppDispatch();
  const logout = useLogout();

  const meta = META[pathname] ?? META['/dashboard'];
  const width = meta.width ?? 'narrow';
  const conn = connection.data;
  const baseUrl = conn && conn.connected ? conn.baseUrl : null;

  const nav: NavItem[] = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/review', label: 'Review', icon: Inbox, badge: stats.data?.pendingReview },
    { to: '/history', label: 'History', icon: History },
    {
      to: '/settings',
      label: 'Settings',
      icon: SlidersHorizontal,
      defaultOpen: true,
      children: [
        { to: '/settings/general', label: 'General' },
        { to: '/settings/processing', label: 'Processing' },
        { to: '/settings/prompts', label: 'Prompts' },
        { to: '/settings/api-keys', label: 'API Keys' },
        { to: '/settings/connection', label: 'Connection' },
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
            <span className="text-sm font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
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
          {baseUrl && (
            <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
              <span className="size-2 shrink-0 rounded-full bg-emerald-500" />
              <span className="truncate group-data-[collapsible=icon]:hidden">{baseUrl}</span>
            </div>
          )}
          <UpdateNotice />
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Support on Ko-fi">
                <a href="https://ko-fi.com/sabbaken" target="_blank" rel="noreferrer">
                  <Coffee />
                  <span>Support on Ko-fi</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={logout} tooltip="Sign out">
                <LogOut />
                <span>Sign out</span>
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

        <div className="flex-1 px-6 py-8">
          <div className={cn('mx-auto w-full', width === 'wide' ? 'max-w-5xl' : 'max-w-3xl')}>
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
  // there). Highlight the parent only when its active child is hidden — when the child is
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
          <SidebarMenuAction aria-label={`Toggle ${item.label}`} className="data-[state=open]:rotate-90">
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
