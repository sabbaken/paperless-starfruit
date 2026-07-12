import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

interface SelectRowProps {
  icon?: ReactNode;
  label: string;
  hint?: string;
  /** Current value; falls back to `placeholder` when null/empty. */
  value: string | null;
  placeholder?: string;
  onClick: () => void;
}

/** A button row that opens a picker: icon + label/hint on the left, value + chevron on the right. */
export function SelectRow({
  icon,
  label,
  hint,
  value,
  placeholder = 'Not set',
  onClick,
}: SelectRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full cursor-pointer items-center gap-3 py-3 text-left"
    >
      {icon && <span className="text-muted-foreground">{icon}</span>}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="truncate text-xs text-muted-foreground">{hint}</p>}
      </div>
      <span className={value ? 'truncate font-mono text-xs' : 'text-xs text-muted-foreground'}>
        {value ?? placeholder}
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </button>
  );
}
