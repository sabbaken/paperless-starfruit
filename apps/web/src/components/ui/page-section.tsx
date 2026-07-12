import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageSectionProps {
  title: string;
  description?: ReactNode;
  /** Optional control aligned to the right of the heading (e.g. an "Add" button). */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * A titled page section: heading, optional description and header action, then
 * content. Deliberately chrome-free: no border, shadow or card background. It
 * groups related controls through hierarchy and whitespace instead of boxing
 * every block in a card, so a page reads as labelled sections rather than a
 * deck of cards. Reach for a real Card only when a block is a discrete object
 * (a list item, a floating surface), not just the default wrapper.
 */
export function PageSection({ title, description, action, children, className }: PageSectionProps) {
  return (
    <section className={cn('space-y-4', className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-base font-semibold leading-none">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
