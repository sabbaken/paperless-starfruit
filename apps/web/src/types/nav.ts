import type { LucideIcon } from 'lucide-react';

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
  /** Start the section expanded even when none of its children is the active route. */
  defaultOpen?: boolean;
}
