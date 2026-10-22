import { Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CheckboxProps {
  checked: boolean | 'indeterminate';
  onCheckedChange: (checked: boolean) => void;
  id?: string;
  'aria-label'?: string;
}

/** Accessible checkbox (role="checkbox"): dependency-free, matches the UI kit. */
export function Checkbox({ checked, onCheckedChange, id, ...rest }: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      id={id}
      aria-checked={checked === 'indeterminate' ? 'mixed' : checked}
      aria-label={rest['aria-label']}
      onClick={() => onCheckedChange(checked !== true)}
      className={cn(
        'flex size-4 shrink-0 cursor-pointer items-center justify-center rounded border outline-none transition-colors',
        'focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        checked ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
      )}
    >
      {checked === 'indeterminate' ? (
        <Minus className="size-3" />
      ) : (
        checked && <Check className="size-3" />
      )}
    </button>
  );
}
