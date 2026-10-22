import { useState } from 'react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useTranslation } from '@/i18n/I18nProvider';

/** Choices are staged in the review; creating taxonomy happens only on approval. */
export function ReviewTaxonomyPicker({
  id,
  label,
  options,
  selected,
  onSelect,
  multiple = false,
  disabled = false,
}: {
  id: string;
  label: string;
  options: string[];
  selected: string[];
  onSelect: (name: string) => void;
  multiple?: boolean;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const names = [...new Set([...options, ...selected])].sort((a, b) => a.localeCompare(b));
  const query = search.trim();
  const exists = names.some((name) => name.toLocaleLowerCase() === query.toLocaleLowerCase());
  const choose = (name: string) => {
    onSelect(name);
    setSearch('');
    if (!multiple) setOpen(false);
  };
  return (
    <Popover
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        setSearch('');
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full min-w-0 justify-between font-normal"
        >
          <span className="truncate">
            {multiple ? label : selected[0] || label}
            {!multiple &&
              selected[0] &&
              !options.some(
                (name) => name.toLocaleLowerCase() === selected[0].toLocaleLowerCase(),
              ) && <span className="text-muted-foreground"> ({t('review.new')})</span>}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-60 p-0">
        <Command>
          <CommandInput
            aria-label={label}
            placeholder={t('review.searchTaxonomy')}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandGroup>
              {!multiple && (
                <CommandItem value="__keep_current__" onSelect={() => choose('')}>
                  {t('review.keepCurrent')}
                </CommandItem>
              )}
              {names.map((name) => (
                <CommandItem key={name} value={name} onSelect={() => choose(name)}>
                  <Check className={selected.includes(name) ? 'size-4' : 'size-4 opacity-0'} />
                  <span className="break-words">{name}</span>
                </CommandItem>
              ))}
              {query && !exists && (
                <CommandItem value={query} onSelect={() => choose(query)}>
                  <Plus className="size-4" />
                  {t('review.createValue', { name: query })}
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
