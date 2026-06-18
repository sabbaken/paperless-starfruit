import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Eye, Loader2, X } from 'lucide-react';
import { PROVIDER_KIND_META, type ProviderModels } from '@paperless-ai/shared';
import { providerApi } from '../lib/api';
import { cn } from '../lib/cn';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface ModelPickerProps {
  title: string;
  /** OCR needs vision: filter cloud models to vision-capable ones. */
  visionOnly?: boolean;
  selected: { providerId: number | null; model: string | null };
  onSelect: (providerId: number, model: string) => void;
  onClose: () => void;
  onAddKey: () => void;
}

type Tab = 'api' | 'local';

export function ModelPicker({
  title,
  visionOnly,
  selected,
  onSelect,
  onClose,
  onAddKey,
}: ModelPickerProps) {
  const models = useQuery({ queryKey: ['available-models'], queryFn: providerApi.models });
  const [tab, setTab] = useState<Tab>('api');

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const api = models.data?.api ?? [];
  const local = models.data?.local ?? [];
  const groups = tab === 'api' ? api : local;
  const empty = !models.isLoading && api.length === 0 && local.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center justify-between border-b px-6">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          <p className="text-xs text-muted-foreground">Pick a model from your connected providers</p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </header>

      {!empty && (
        <div className="flex shrink-0 gap-1 border-b px-6">
          <TabButton active={tab === 'api'} onClick={() => setTab('api')} count={api.length}>
            API models
          </TabButton>
          <TabButton active={tab === 'local'} onClick={() => setTab('local')} count={local.length}>
            Local models
          </TabButton>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-3xl space-y-8">
          {models.isLoading ? (
            <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
          ) : empty ? (
            <div className="space-y-3 py-12 text-center">
              <p className="text-sm text-muted-foreground">No providers connected yet.</p>
              <Button onClick={onAddKey}>Add an API key</Button>
            </div>
          ) : groups.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {tab === 'api'
                ? 'No cloud providers connected.'
                : 'No local endpoints connected.'}
            </p>
          ) : (
            groups.map((group) => (
              <ProviderGroup
                key={group.providerId}
                group={group}
                visionOnly={visionOnly}
                selected={selected}
                onSelect={onSelect}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function ProviderGroup({
  group,
  visionOnly,
  selected,
  onSelect,
}: {
  group: ProviderModels;
  visionOnly?: boolean;
  selected: { providerId: number | null; model: string | null };
  onSelect: (providerId: number, model: string) => void;
}) {
  const meta = PROVIDER_KIND_META[group.kind];
  // For OCR, cloud models are filtered to vision-capable; local vision is unknown.
  const models = visionOnly && !meta.local ? group.models.filter((m) => m.vision) : group.models;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">{group.providerName}</h3>
        <Badge variant="outline">{meta.label}</Badge>
      </div>

      {group.manual ? (
        <ManualModel providerId={group.providerId} selected={selected} onSelect={onSelect} />
      ) : models.length === 0 ? (
        <p className="text-sm text-muted-foreground">No matching models.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {models.map((m) => {
            const active = selected.providerId === group.providerId && selected.model === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onSelect(group.providerId, m.id)}
                className={cn(
                  'flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors',
                  active ? 'border-primary bg-primary/5' : 'hover:bg-accent/60',
                )}
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{m.label}</div>
                  <div className="truncate font-mono text-xs text-muted-foreground">{m.id}</div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {m.vision && <Eye className="size-3.5 text-muted-foreground" aria-label="vision" />}
                  {active && <Check className="size-4 text-primary" />}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

/** Local endpoint we couldn't list — let the user type a model id. */
function ManualModel({
  providerId,
  selected,
  onSelect,
}: {
  providerId: number;
  selected: { providerId: number | null; model: string | null };
  onSelect: (providerId: number, model: string) => void;
}) {
  const [value, setValue] = useState(
    selected.providerId === providerId ? (selected.model ?? '') : '',
  );
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Couldn’t list this endpoint’s models — enter a model id manually.
      </p>
      <div className="flex gap-2">
        <Input
          className="font-mono"
          placeholder="llama3.1"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <Button type="button" disabled={!value.trim()} onClick={() => onSelect(providerId, value.trim())}>
          Use
        </Button>
      </div>
    </div>
  );
}

function TabButton({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean;
  count: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        '-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
        active
          ? 'border-primary text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
      <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
    </button>
  );
}
