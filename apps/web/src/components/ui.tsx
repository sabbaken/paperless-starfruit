import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { cn } from '../lib/cn';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost';
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', className, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium',
        'transition-colors focus-visible:outline-none focus-visible:ring-2',
        'focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900',
        'disabled:cursor-not-allowed disabled:opacity-40',
        variant === 'primary' &&
          'bg-signal text-ink-950 hover:bg-signal-bright focus-visible:ring-signal',
        variant === 'ghost' &&
          'border border-line text-paper-dim hover:border-line-bright hover:text-paper focus-visible:ring-line-bright',
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = 'Button';

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'w-full rounded-md border border-line bg-ink-950 px-3 py-2.5 font-mono text-sm text-paper',
        'placeholder:text-paper-faint transition-colors',
        'focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal',
        'aria-[invalid=true]:border-alert aria-[invalid=true]:focus:border-alert aria-[invalid=true]:focus:ring-alert',
        className,
      )}
      {...props}
    />
  ),
);
TextInput.displayName = 'TextInput';

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label
          htmlFor={htmlFor}
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-paper-dim"
        >
          {label}
        </label>
        {hint && <span className="font-mono text-[11px] text-paper-faint">{hint}</span>}
      </div>
      {children}
      {error && <p className="font-mono text-xs text-alert">{error}</p>}
    </div>
  );
}
