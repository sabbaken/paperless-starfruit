import { useEffect, useState, type ReactNode } from 'react';
import { Check, ChevronDown, ChevronsUpDown, ChevronUp, Eye, Loader2, Lock, Search } from 'lucide-react';
import {
  PROVIDER_KIND_META,
  type ModelInfo,
  type ProviderKind,
  type ProviderModels,
} from '@paperless-starfruit/shared';
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
import { ProviderLogo } from '@/components/provider-logo.tsx';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

/**
 * Default shortlist, built in two stages:
 *
 *   1. SHORTLIST — a hand-picked allowlist of model *families* per vendor. This
 *      decides which families show up at all. Versions are omitted (latestPerFamily
 *      collapses each family to its newest member) and so are "preview"/"latest"
 *      aliases (stripped by FAMILY_NOISE), so `gemini-pro` covers 2.5 Pro, 3 Pro
 *      Preview, etc. — all one family.
 *   2. SHORTLIST_EXCLUDE — substrings that drop individual variants *within* those
 *      families. Matched against `id` + `label`, so e.g. "preview" removes Gemini's
 *      preview builds, leaving the newest *stable* release as the family's latest.
 *
 * A model is in the shortlist when its family is allowlisted AND it isn't excluded.
 * "Show all models" bypasses both. Keys here are family keys as produced by
 * `familyKey()`; exclude patterns are plain case-insensitive substrings.
 */
const SHORTLIST: Partial<Record<ProviderKind, string[]>> = {
  anthropic: ['claude-opus', 'claude-sonnet', 'claude-haiku'],
  google: ['gemini-pro', 'gemini-flash', 'gemini-flash-lite'],
  openai: ['gpt-pro', 'gpt', 'gpt-mini', 'gpt-nano'],
  mistral: ['mistral-large', 'pixtral-large', 'mistral-medium', 'mistral-small'],
};

const SHORTLIST_EXCLUDE: Partial<Record<ProviderKind, string[]>> = {
  google: ['preview'],
  // openai: ['codex'],
  // anthropic: [],
  // mistral: [],
};

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
  /** Estimated cost to process one page with this model (null when unpriced). */
  perPage: number | null;
}

type SortKey = 'model' | 'provider' | 'input' | 'output' | 'perPage';
interface Sort {
  key: SortKey;
  dir: 'asc' | 'desc';
}

/** USD-per-token → a compact "$X.XX" per 1M tokens. */
function formatPrice(perToken: number): string {
  return `$${(perToken * 1_000_000).toFixed(2)}`;
}

/**
 * Rough tokens-per-page used to anchor the cost estimate. Real usage swings with
 * document size, layout and language — this is only a relative comparison number.
 * cost = tokensIn × priceIn + tokensOut × priceOut.
 */
const PER_PAGE_TOKENS = {
  ocr: { in: 3000, out: 900 },
  analysis: { in: 1300, out: 500 },
} as const;

function perPageCost(pricing: ModelInfo['pricing'], ocr: boolean): number | null {
  if (!pricing) return null;
  const t = ocr ? PER_PAGE_TOKENS.ocr : PER_PAGE_TOKENS.analysis;
  return t.in * pricing.input + t.out * pricing.output;
}

/** Format a tiny per-page dollar amount keeping ~2 significant figures. */
function formatPerPage(cost: number): string {
  if (cost <= 0) return '$0';
  const decimals = Math.min(6, Math.max(2, -Math.floor(Math.log10(cost)) + 1));
  return `$${cost.toFixed(decimals)}`;
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

function buildRows(groups: DisplayGroup[], ocr: boolean): ModelRow[] {
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
      perPage: perPageCost(m.pricing, ocr),
    }));
  });
}

function compareRows(a: ModelRow, b: ModelRow, sort: Sort): number {
  const byLabel = a.model.label.localeCompare(b.model.label);
  if (sort.key === 'input' || sort.key === 'output' || sort.key === 'perPage') {
    const av = sort.key === 'perPage' ? a.perPage : (a.model.pricing?.[sort.key] ?? null);
    const bv = sort.key === 'perPage' ? b.perPage : (b.model.pricing?.[sort.key] ?? null);
    // Unpriced models (e.g. local) always sort last, regardless of direction.
    if (av == null || bv == null) return av == null ? (bv == null ? byLabel : 1) : -1;
    const r = av - bv || byLabel;
    return sort.dir === 'asc' ? r : -r;
  }
  const r = sort.key === 'provider' ? a.company.localeCompare(b.company) || byLabel : byLabel;
  return sort.dir === 'asc' ? r : -r;
}

/** Words that don't define a family — dropped so a model and its "preview"/"latest"
 *  alias collapse together (e.g. `gemini-pro` covers "Gemini 3.1 Pro Preview"). This
 *  is what lets SHORTLIST_EXCLUDE then surgically drop the preview variant. */
const FAMILY_NOISE = new Set(['preview', 'latest']);

/** A model "line", ignoring version numbers — e.g. "Claude 3 Haiku" and
 *  "Claude Haiku 4.5" both reduce to `claude-haiku`. Derived from the label so the
 *  decimal versions ("4.5", "3.1") stay intact for `versionOf`. */
function familyKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/\d+(\.\d+)?/g, ' ') // drop version numbers wherever they sit
    .replace(/[^a-z]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((w) => w && !FAMILY_NOISE.has(w))
    .join('-');
}

/** Highest version number in a label (ignoring date/size-like values). */
function versionOf(label: string): number {
  const nums = (label.match(/\d+(\.\d+)?/g) ?? []).map(Number).filter((n) => n < 100);
  return nums.length ? Math.max(...nums) : 0;
}

/** Stage 1: a model's family is on the hand-picked allowlist. Local providers are
 *  user-configured (few, hand-picked) so they always pass. */
function inShortlist(r: ModelRow): boolean {
  if (PROVIDER_KIND_META[r.kind].local) return true;
  return SHORTLIST[r.kind]?.includes(familyKey(r.model.label)) ?? false;
}

/** Stage 2: a model is buried by a SHORTLIST_EXCLUDE substring (id or label). */
function excludedFromShortlist(r: ModelRow): boolean {
  const patterns = SHORTLIST_EXCLUDE[r.kind];
  if (!patterns?.length) return false;
  const hay = `${r.model.id} ${r.model.label}`.toLowerCase();
  return patterns.some((p) => hay.includes(p.toLowerCase()));
}

/** Keep only the newest model in each line (per provider), preserving order. */
function latestPerFamily(rows: ModelRow[]): ModelRow[] {
  const best = new Map<string, ModelRow>();
  for (const r of rows) {
    const fam = `${r.kind}:${familyKey(r.model.label)}`;
    const cur = best.get(fam);
    if (!cur || versionOf(r.model.label) > versionOf(cur.model.label)) best.set(fam, r);
  }
  return rows.filter((r) => best.get(`${r.kind}:${familyKey(r.model.label)}`) === r);
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
  const [showAll, setShowAll] = useState(false);
  const [sort, setSort] = useState<Sort>({ key: 'provider', dir: 'asc' });
  // The OCR picker (visionOnly) costs more per page than plain text analysis.
  const ocr = !!visionOnly;
  const perPageTooltip = ocr
    ? 'Rough estimate — ~3,000 input + 900 output tokens per page (OCR). Varies with the document.'
    : 'Rough estimate — ~1,300 input + 500 output tokens per page (analysis). Varies with the document.';

  const connectedApi = models.data?.api ?? [];
  const local = models.data?.local ?? [];
  const catalog = models.data?.catalog ?? {};

  // Supported vendors without a configured credential — previewed as locked rows
  // so users can see what exists and that adding a key unlocks it.
  const connectedKinds = new Set(connectedApi.map((g) => g.kind));
  const lockedGroups: DisplayGroup[] = (Object.keys(catalog) as ProviderKind[])
    .filter((kind) => !connectedKinds.has(kind) && catalog[kind].length > 0)
    .map((kind) => ({
      id: `locked-${kind}`,
      name: PROVIDER_KIND_META[kind].label,
      kind,
      providerId: null,
      manual: false,
      models: catalog[kind],
      locked: true,
    }));

  const allGroups = [...connectedApi.map(fromConnected), ...lockedGroups, ...local.map(fromConnected)];
  // Endpoints we couldn't list need a free-text model id, so they can't be table rows.
  const manualGroups = allGroups.filter((g) => g.manual);

  // Debug: log every available model (full set, before any shortlist/search/vision filtering).
  useEffect(() => {
    const names = allGroups.flatMap((g) => g.models.map((m) => m.label));
    console.log(`[ModelPicker] ${names.length} models:`, names);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [models.data]);

  const q = search.trim().toLowerCase();
  const matched = buildRows(allGroups.filter((g) => !g.manual), ocr)
    .filter((r) => !visionOnly || PROVIDER_KIND_META[r.kind].local || r.model.vision)
    .filter(
      (r) =>
        !q ||
        r.model.label.toLowerCase().includes(q) ||
        r.model.id.toLowerCase().includes(q) ||
        r.company.toLowerCase().includes(q) ||
        (r.account?.toLowerCase().includes(q) ?? false),
    );
  // Default shortlist: allowlisted family AND not excluded, then newest per family.
  // The toggle reveals everything.
  const rows = (
    showAll
      ? matched
      : latestPerFamily(matched.filter((r) => inShortlist(r) && !excludedFromShortlist(r)))
  ).sort((a, b) => compareRows(a, b, sort));

  const onSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

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
          <label className="flex cursor-pointer items-center gap-2 text-sm whitespace-nowrap text-muted-foreground">
            <Switch checked={showAll} onCheckedChange={setShowAll} />
            Show all models
          </label>
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
                    {showAll && (
                      <>
                        <Th sortKey="input" sort={sort} onSort={onSort} className="w-28">
                          Input <span className="font-normal text-muted-foreground/70">$/1M</span>
                        </Th>
                        <Th sortKey="output" sort={sort} onSort={onSort} className="w-28">
                          Output <span className="font-normal text-muted-foreground/70">$/1M</span>
                        </Th>
                      </>
                    )}
                    <Th sortKey="perPage" sort={sort} onSort={onSort} className="w-28" title={perPageTooltip}>
                      Est. <span className="font-normal text-muted-foreground/70">/page</span>
                    </Th>
                    <Th className="w-12" />
                  </tr>
                  </thead>
                  <tbody>
                  <TooltipProvider delayDuration={300}>
                  {rows.map((r) => {
                    const active =
                      !r.locked &&
                      selected.providerId === r.providerId &&
                      selected.model === r.model.id;
                    const row = (
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
                            <ProviderLogo
                              kind={r.kind}
                              className={cn('size-5 shrink-0', r.locked && 'opacity-70 grayscale-50')}
                            />
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
                        {showAll && (
                          <>
                            <td className="px-3 py-2.5 tabular-nums">
                              {r.model.pricing ? (
                                formatPrice(r.model.pricing.input)
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 tabular-nums">
                              {r.model.pricing ? (
                                formatPrice(r.model.pricing.output)
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                          </>
                        )}
                        <td className="px-3 py-2.5 tabular-nums">
                          {r.perPage != null ? (
                            formatPerPage(r.perPage)
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {active && <Check className="ml-auto size-4 text-primary" />}
                        </td>
                      </tr>
                    );
                    return r.locked ? (
                      <Tooltip key={r.key}>
                        <TooltipTrigger asChild>{row}</TooltipTrigger>
                        <TooltipContent>Add an API key to unlock.</TooltipContent>
                      </Tooltip>
                    ) : (
                      row
                    );
                  })}
                  </TooltipProvider>
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
              title,
            }: {
  children?: ReactNode;
  className?: string;
  sortKey?: SortKey;
  sort?: Sort;
  onSort?: (key: SortKey) => void;
  title?: string;
}) {
  const active = !!sortKey && sort?.key === sortKey;
  const Icon = !active ? ChevronsUpDown : sort!.dir === 'asc' ? ChevronUp : ChevronDown;
  return (
    <th
      title={title}
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
