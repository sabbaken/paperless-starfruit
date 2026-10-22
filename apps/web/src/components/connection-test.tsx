import { useId } from 'react';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ConnectionTestProps {
  label: string;
  onTest: () => void;
  pending: boolean;
  disabled?: boolean;
  error?: string;
  success?: string;
}

/** An inline connection probe with its result beside the action. */
export function ConnectionTest({
  label,
  onTest,
  pending,
  disabled,
  error,
  success,
}: ConnectionTestProps) {
  const resultId = useId();
  const message = pending ? undefined : error || success;

  return (
    <div className="flex items-start gap-3">
      <Button
        type="button"
        variant="link"
        className="h-auto min-h-9 px-0 py-2 has-[>svg]:px-0"
        onClick={onTest}
        disabled={pending || disabled}
        aria-busy={pending}
        aria-describedby={message ? resultId : undefined}
      >
        {label}
      </Button>
      <div
        id={resultId}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="min-w-0 py-2"
      >
        {pending && (
          <Loader2
            aria-hidden="true"
            className="mt-0.5 size-4 animate-spin text-muted-foreground motion-reduce:animate-none"
          />
        )}
        {message && (
          <p
            className={cn(
              'flex items-start gap-2 text-sm',
              error ? 'text-destructive' : 'text-emerald-700 dark:text-emerald-500',
            )}
          >
            {error ? (
              <XCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            ) : (
              <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            )}
            <span className="min-w-0 break-words [overflow-wrap:anywhere]">{message}</span>
          </p>
        )}
      </div>
    </div>
  );
}
