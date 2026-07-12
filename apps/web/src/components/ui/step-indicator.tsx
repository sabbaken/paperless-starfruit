import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StepIndicatorProps {
  /** Step labels, in order; hidden on narrow viewports (dots stay clickable). */
  steps: string[];
  /** 0-based index of the active step. */
  current: number;
  onSelect: (index: number) => void;
  className?: string;
}

/**
 * Numbered step tabs for a wizard-style flow. Steps before `current` show a
 * check; every step is clickable, so the flow can be jumped around freely.
 * Gating, if any, is the caller's job.
 */
export function StepIndicator({ steps, current, onSelect, className }: StepIndicatorProps) {
  return (
    <ol aria-label="Steps" className={cn('flex items-center gap-2', className)}>
      {steps.map((title, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={title} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onSelect(i)}
              aria-current={active ? 'step' : undefined}
              className="flex cursor-pointer items-center gap-2"
            >
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium',
                  active
                    ? 'border-brand bg-brand text-brand-foreground'
                    : done
                      ? 'border-brand text-brand'
                      : 'text-muted-foreground',
                )}
              >
                {done ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span
                className={cn(
                  'hidden text-sm whitespace-nowrap lg:inline',
                  active ? 'font-medium' : 'text-muted-foreground',
                )}
              >
                {title}
              </span>
            </button>
            {i < steps.length - 1 && <span aria-hidden className="h-px w-5 bg-border" />}
          </li>
        );
      })}
    </ol>
  );
}
