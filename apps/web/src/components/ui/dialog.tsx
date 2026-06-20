import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Centered modal dialog — backdrop, Escape / click-outside to close, body-scroll
 * lock. Dependency-free, matching the hand-rolled UI kit. `fixed` overlays the
 * whole viewport regardless of where it sits in the tree.
 */
export function Dialog({ open, onClose, title, description, children, className }: DialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl border bg-card text-card-foreground shadow-lg',
          className,
        )}
      >
        {(title || description) && (
          <div className="flex items-start justify-between gap-4 border-b px-6 py-4">
            <div className="min-w-0 space-y-1">
              {title && <h2 className="leading-none font-semibold">{title}</h2>}
              {description && <p className="text-sm text-muted-foreground">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-1 -mt-1 flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        )}
        <div className="overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
