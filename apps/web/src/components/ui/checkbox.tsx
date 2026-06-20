import { Check } from 'lucide-react';
import { cn } from '../../lib/cn';

interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id?: string;
  'aria-label'?: string;
}

/** Accessible checkbox (role="checkbox") — dependency-free, matches the UI kit. */
export function Checkbox({ checked, onCheckedChange, id, ...rest }: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      id={id}
      aria-checked={checked}
      aria-label={rest['aria-label']}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'flex size-4 shrink-0 cursor-pointer items-center justify-center rounded border outline-none transition-colors',
        'focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        checked ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
      )}
    >
      {checked && <Check className="size-3" />}
    </button>
  );
}
