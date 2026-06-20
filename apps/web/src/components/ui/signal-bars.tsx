import { cn } from '@/lib/utils';

interface SignalBarsProps {
  /** Rating to display, from 0 to `max`. */
  value: number;
  /** Top of the scale. */
  max?: number;
  /** How many bars to render. */
  bars?: number;
  className?: string;
}

/** Increasing-height bars (phone signal style) plus the numeric value beside them. */
export function SignalBars({ value, max = 5, bars = 4, className }: SignalBarsProps) {
  const clamped = Math.max(0, Math.min(max, value));
  const filled = Math.round((clamped / max) * bars);
  const label = Number.isInteger(clamped) ? String(clamped) : clamped.toFixed(1);

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span className="flex h-4 items-end gap-0.5" role="img" aria-label={`${label} out of ${max}`}>
        {Array.from({ length: bars }, (_, i) => (
          <span
            key={i}
            className={cn(
              'w-1 rounded-[1px] transition-colors',
              i < filled ? 'bg-primary' : 'bg-muted-foreground/20',
            )}
            // Step heights evenly from short to full across the bar count.
            style={{ height: `${((i + 1) / bars) * 100}%` }}
          />
        ))}
      </span>
      <span className="text-xs font-medium tabular-nums text-muted-foreground">{label}</span>
    </span>
  );
}
