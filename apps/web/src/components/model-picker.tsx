import { useState, type ReactNode } from 'react';
import { Check, ChevronDown, ChevronsUpDown, ChevronUp, Eye, Loader2, Lock, Search } from 'lucide-react';
import {
  CLOUD_PROVIDER_KINDS,
  MODEL_CATALOG,
  PROVIDER_KIND_META,
  type ModelInfo,
  type ProviderKind,
  type ProviderModels,
} from '@paperless-ai/shared';
import { useAvailableModels } from '@/api/providers';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ProviderLogo } from '@/components/ui/provider-logo';
import { SignalBars } from '@/components/ui/signal-bars';

interface ModelPickerProps {
  title: string;
  /** OCR needs vision: filter cloud models to vision-capable ones. */
  visionOnly?: boolean;
  selected: { providerId: number | null; model: string | null };
  onSelect: (providerId: number, model: string) => void;
  onClose: () => void;
  onAddKey: () => void;
}

/** A provider — either a connected credential or a locked catalog preview. */
interface DisplayGroup {
  id: string;
  name: string;
  kind: ProviderKind;
  providerId: number | null;
  manual: boolean;
  models: ModelInfo[];
  /** No API key connected yet — shown disabled to hint that it's available. */
  locked: boolean;
}

/** One row in the flat table: a single model, with the provider it belongs to. */
interface ModelRow {
  key: string;
  providerId: number | null;
  /** AI lab / company, e.g. "Anthropic". */
  company: string;
  /** The credential's given name, when it differs from the company. */
  account: string | null;
  kind: ProviderKind;
  model: ModelInfo;
  locked: boolean;
}

type SortKey = 'model' | 'provider' | 'intelligence';
interface Sort {
  key: SortKey;
  dir: 'asc' | 'desc';
}

const fromConnected = (g: ProviderModels): DisplayGroup => ({
  id: `connected-${g.providerId}`,
  name: g.providerName,
  kind: g.kind,
  providerId: g.providerId,
  manual: g.manual,
  models: g.models,
  locked: false,
});

function buildRows(groups: DisplayGroup[]): ModelRow[] {
  return groups.flatMap((g) => {
    const company = PROVIDER_KIND_META[g.kind].label;
    const account = g.name && g.name !== company ? g.name : null;
    return g.models.map((m) => ({
      key: `${g.id}:${m.id}`,
      providerId: g.providerId,
      company,
      account,
      kind: g.kind,
      model: m,
      locked: g.locked,
    }));
  });
}

function compareRows(a: ModelRow, b: ModelRow, sort: Sort): number {
  let r = 0;
  switch (sort.key) {
    case 'model':
      r = a.model.label.localeCompare(b.model.label);
      break;
    case 'provider':
      r = a.company.localeCompare(b.company) || a.model.label.localeCompare(b.model.label);
      break;
    case 'intelligence':
      // Unknown ratings (local models) sort to the bottom.
      r = (a.model.intelligence ?? -1) - (b.model.intelligence ?? -1);
      break;
  }
  return sort.dir === 'asc' ? r : -r;
}

export function ModelPicker({
  title,
  visionOnly,
  selected,
  onSelect,
  onClose,
  onAddKey,
}: ModelPickerProps) {
  const models = useAvailableModels();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<Sort>({ key: 'intelligence', dir: 'desc' });

  const connectedApi = models.data?.api ?? [];
  const local = models.data?.local ?? [];

  // Cloud kinds without a configured credential — previewed as locked rows so users
  // can see what exists and that adding a key unlocks it.
  const connectedKinds = new Set(connectedApi.map((g) => g.kind));
  const lockedGroups: DisplayGroup[] = CLOUD_PROVIDER_KINDS.filter(
    (kind) => !connectedKinds.has(kind) && MODEL_CATALOG[kind].length > 0,
  ).map((kind) => ({
    id: `locked-${kind}`,
    name: PROVIDER_KIND_META[kind].label,
    kind,
    providerId: null,
    manual: false,
    models: MODEL_CATALOG[kind],
    locked: true,
  }));

  const allGroups = [...connectedApi.map(fromConnected), ...lockedGroups, ...local.map(fromConnected)];
  // Endpoints we couldn't list need a free-text model id, so they can't be table rows.
  const manualGroups = allGroups.filter((g) => g.manual);

  const q = search.trim().toLowerCase();
  const rows = buildRows(allGroups.filter((g) => !g.manual))
    .filter((r) => !visionOnly || PROVIDER_KIND_META[r.kind].local || r.model.vision)
    .filter(
      (r) =>
        !q ||
        r.model.label.toLowerCase().includes(q) ||
        r.model.id.toLowerCase().includes(q) ||
        r.company.toLowerCase().includes(q) ||
        (r.account?.toLowerCase().includes(q) ?? false),
    )
    .sort((a, b) => compareRows(a, b, sort));

  const onSort = (key: SortKey) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'intelligence' ? 'desc' : 'asc' },
    );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex h-[90vh] w-[95vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
        <DialogHeader className="shrink-0 space-y-1 border-b px-6 py-4">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Pick a model. Locked rows need an API key — add one to unlock them.
          </DialogDescription>
        </DialogHeader>

        <div className="flex shrink-0 items-center gap-3 border-b px-6 py-3">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search models…"
              className="pl-8"
            />
          </div>
          <Button variant="outline" size="sm" onClick={onAddKey}>
            Add API key
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {models.isLoading ? (
            <Loader2 className="mx-auto mt-12 size-5 animate-spin text-muted-foreground" />
          ) : rows.length === 0 && manualGroups.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {q ? 'No models match your search.' : 'No models available.'}
            </p>
          ) : (
            <div className="px-6 pb-6">
              {rows.length > 0 ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <Th sortKey="model" sort={sort} onSort={onSort}>
                        Model
                      </Th>
                      <Th sortKey="provider" sort={sort} onSort={onSort} className="w-52">
                        Provider
                      </Th>
                      <Th className="w-20">Vision</Th>
                      <Th sortKey="intelligence" sort={sort} onSort={onSort} className="w-44">
                        Intelligence
                      </Th>
                      <Th className="w-12" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const active =
                        !r.locked &&
                        selected.providerId === r.providerId &&
                        selected.model === r.model.id;
                      return (
                        <tr
                          key={r.key}
                          onClick={r.locked ? undefined : () => onSelect(r.providerId!, r.model.id)}
                          aria-disabled={r.locked}
                          className={cn(
                            'border-b transition-colors last:border-0',
                            r.locked
                              ? 'cursor-not-allowed text-muted-foreground'
                              : active
                                ? 'cursor-pointer bg-primary/5'
                                : 'cursor-pointer hover:bg-accent/60',
                          )}
                        >
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-3">
                              <ProviderLogo kind={r.kind} className="size-5 shrink-0" />
                              <div className="min-w-0">
                                <div className="truncate font-medium">{r.model.label}</div>
                                <div className="truncate font-mono text-xs text-muted-foreground">
                                  {r.model.id}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1.5">
                              {r.locked && <Lock className="size-3 shrink-0 text-muted-foreground" />}
                              <div className="min-w-0">
                                <div className="truncate">{r.company}</div>
                                {r.account && (
                                  <div className="truncate text-xs text-muted-foreground">
                                    {r.account}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            {r.model.vision ? (
                              <Eye className="size-4 text-muted-foreground" aria-label="vision" />
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            {r.model.intelligence != null ? (
                              <SignalBars value={r.model.intelligence} />
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            {active && <Check className="ml-auto size-4 text-primary" />}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                q && (
                  <p className="py-12 text-center text-sm text-muted-foreground">
                    No models match your search.
                  </p>
                )
              )}

              {manualGroups.length > 0 && (
                <div className="mt-8 space-y-4">
                  {manualGroups.map((g) => (
                    <div key={g.id} className="space-y-2">
                      <h3 className="text-sm font-semibold">{g.name}</h3>
                      <ManualModel
                        providerId={g.providerId!}
                        selected={selected}
                        onSelect={onSelect}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** A table header cell — sortable when `sortKey` is given. */
function Th({
  children,
  className,
  sortKey,
  sort,
  onSort,
}: {
  children?: ReactNode;
  className?: string;
  sortKey?: SortKey;
  sort?: Sort;
  onSort?: (key: SortKey) => void;
}) {
  const active = !!sortKey && sort?.key === sortKey;
  const Icon = !active ? ChevronsUpDown : sort!.dir === 'asc' ? ChevronUp : ChevronDown;
  return (
    <th
      className={cn(
        'sticky top-0 z-10 border-b bg-muted px-3 py-2 text-left text-xs font-medium text-muted-foreground',
        className,
      )}
    >
      {sortKey ? (
        <button
          type="button"
          onClick={() => onSort?.(sortKey)}
          className="flex cursor-pointer items-center gap-1 hover:text-foreground"
        >
          {children}
          <Icon className={cn('size-3.5', active ? 'text-foreground' : 'text-muted-foreground/40')} />
        </button>
      ) : (
        children
      )}
    </th>
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
