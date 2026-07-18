import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface LanguageComboboxOption {
  code: string;
  name: string;
  emoji?: string | null;
}

type TriggerProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'value' | 'onChange' | 'type'
>;

export interface LanguageComboboxProps extends TriggerProps {
  /** Currently selected language code. */
  value?: string;
  /** Called with the selected language code. */
  onChange: (code: string) => void;
  options: LanguageComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  contentClassName?: string;
  align?: 'start' | 'center' | 'end';
}

const matches = (option: LanguageComboboxOption, query: string) =>
  option.name.toLowerCase().includes(query) || option.code.toLowerCase().includes(query);

const Flag = ({ emoji }: { emoji?: string | null }) =>
  emoji ? (
    <span aria-hidden className="w-5 shrink-0 text-center text-base leading-none">
      {emoji}
    </span>
  ) : null;

/**
 * Searchable language picker. Presentational — the caller supplies `options` and
 * persists the choice via `onChange`. Uses cmdk with `shouldFilter={false}` and
 * does its own name+code substring filtering so behavior is deterministic.
 */
const LanguageCombobox = React.forwardRef<React.ElementRef<typeof Button>, LanguageComboboxProps>(
  (
    {
      value,
      onChange,
      options,
      placeholder = 'Select language',
      searchPlaceholder = 'Search languages',
      emptyText = 'No language found',
      className,
      contentClassName,
      align = 'start',
      ...triggerProps
    },
    ref,
  ) => {
    const [open, setOpen] = React.useState(false);
    const [search, setSearch] = React.useState('');

    const optionByCode = React.useMemo(() => {
      const map = new Map<string, LanguageComboboxOption>();
      for (const option of options) map.set(option.code, option);
      return map;
    }, [options]);

    const selected = value ? optionByCode.get(value) : undefined;

    const query = search.trim().toLowerCase();
    const filteredOptions = React.useMemo(
      () => (query ? options.filter((option) => matches(option, query)) : options),
      [options, query],
    );

    const handleSelect = (code: string) => {
      onChange(code);
      setSearch('');
      setOpen(false);
    };

    const handleOpenChange = (next: boolean) => {
      setOpen(next);
      if (!next) setSearch('');
    };

    return (
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            {...triggerProps}
            ref={ref}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              'h-10 w-full min-w-0 justify-between px-3 font-normal',
              !selected && 'text-zinc-500 dark:text-neutral-400',
              className,
            )}
          >
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <Flag emoji={selected?.emoji} />
              <span className="truncate text-left">{selected ? selected.name : placeholder}</span>
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align={align}
          className={cn(
            'w-[var(--radix-popover-trigger-width)] min-w-[12rem] p-0',
            contentClassName,
          )}
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={searchPlaceholder}
              value={search}
              onValueChange={setSearch}
            />
            <CommandList
              className="max-h-64"
              // When this combobox opens inside a Radix Dialog, the Dialog's
              // react-remove-scroll lock cancels wheel/touch events on this list
              // because the popover is portaled outside the Dialog subtree. Stop
              // propagation so the list scrolls natively instead of being blocked.
              onWheel={(event) => event.stopPropagation()}
              onTouchMove={(event) => event.stopPropagation()}
            >
              {filteredOptions.length === 0 ? (
                <div className="py-6 text-center text-sm text-zinc-500 dark:text-neutral-400">
                  {emptyText}
                </div>
              ) : (
                <CommandGroup>
                  {filteredOptions.map((option) => (
                    <CommandItem
                      key={option.code}
                      value={option.code}
                      onSelect={() => handleSelect(option.code)}
                      className="cursor-pointer"
                    >
                      <Flag emoji={option.emoji} />
                      <span className="truncate">{option.name}</span>
                      <Check
                        className={cn(
                          'ml-auto h-4 w-4',
                          option.code === value ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  },
);

LanguageCombobox.displayName = 'LanguageCombobox';

export { LanguageCombobox };
