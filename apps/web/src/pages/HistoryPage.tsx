import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { ChevronDown, Loader2, Search, SearchX } from 'lucide-react';
import {
  AUDIT_DECISIONS,
  extractionSchema,
  type AuditEntryDetail,
  type AuditEntrySummary,
} from '@paperless-starfruit/shared';
import { useAuditDetail, useAuditLog } from '@/api/audit';
import { useDebouncedCallback } from '@/hooks/use-debounced-callback';
import { useTranslation } from '@/i18n/I18nProvider';
import { cn } from '@/lib/utils';
import { DocumentLink } from '@/components/document-link';
import { Button } from '@/components/ui/button';
import { PageSection } from '@/components/ui/page-section';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableAction,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const PAGE_SIZE = 25;

const DECISION_TONE: Record<string, string> = {
  'auto-applied': 'text-emerald-700 dark:text-emerald-500',
  'review-queued': 'text-blue-700 dark:text-blue-400',
  'ocr-only': 'text-cyan-700 dark:text-cyan-400',
  approved: 'text-emerald-700 dark:text-emerald-500',
  rejected: 'text-destructive',
  skipped: 'text-muted-foreground',
};

function decisionTone(decision: string | null): string {
  return (decision && DECISION_TONE[decision]) || 'text-foreground';
}

// Narrow a possibly-null/unknown decision to a valid `auditDecisions.*` dict key
// so `t()` stays type-safe; anything unrecognised renders as "unknown".
function decisionKey(decision: string | null): (typeof AUDIT_DECISIONS)[number] | 'unknown' {
  return (AUDIT_DECISIONS as readonly string[]).includes(decision ?? '')
    ? (decision as (typeof AUDIT_DECISIONS)[number])
    : 'unknown';
}

function formatTime(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString();
}

/** Job-history / audit log: inspect the exact prompt sent to the LLM and its response. */
export function HistoryPage() {
  return <HistoryList />;
}

function HistoryList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const search = params.get('q') ?? '';
  const decision = params.get('decision') || undefined;
  const rawOffset = Number(params.get('offset'));
  const offset = Number.isSafeInteger(rawOffset) && rawOffset > 0 ? rawOffset : 0;
  const [q, setQ] = useState(search);
  const updateFilters = (values: Record<string, string | undefined>) => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(values)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        return next;
      },
      { replace: true },
    );
  };
  const onOpen = (id: number) => navigate(`/history/${id}${params.size ? `?${params}` : ''}`);
  // Debounce the free-text search so we don't fire a /audit request per keystroke;
  // the committed value (and a reset to page 1) lands 300ms after typing stops.
  const commitSearch = useDebouncedCallback(() => {
    updateFilters({ q: q.trim(), offset: undefined });
  }, 300);

  const log = useAuditLog({ q: search || undefined, decision, limit: PAGE_SIZE, offset });
  const items = log.data?.items ?? [];
  const total = log.data?.total ?? 0;

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            commitSearch();
          }}
          aria-label={t('history.searchPlaceholder')}
          placeholder={t('history.searchPlaceholder')}
          className="pl-8"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Chip
          label={t('history.all')}
          active={!decision}
          onClick={() => {
            updateFilters({ decision: undefined, offset: undefined });
          }}
        />
        {AUDIT_DECISIONS.map((d) => (
          <Chip
            key={d}
            label={t(`auditDecisions.${d}`)}
            active={decision === d}
            onClick={() => {
              updateFilters({ decision: d, offset: undefined });
            }}
          />
        ))}
      </div>

      {log.isLoading ? (
        <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
      ) : log.isError ? (
        <div className="space-y-3">
          <p role="alert">{t('history.loadFailed')}</p>
          <Button variant="outline" onClick={() => void log.refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      ) : items.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchX />
            </EmptyMedia>
            <EmptyTitle>{t('history.emptyTitle')}</EmptyTitle>
            <EmptyDescription>
              {t('history.emptyDescriptionBefore')}
              <code className="font-mono">psf-process</code>
              {t('history.emptyDescriptionAfter')}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('history.decisionHeader')}</TableHead>
                <TableHead>{t('history.documentHeader')}</TableHead>
                <TableHead className="w-full">{t('history.whenHeader')}</TableHead>
                <TableHead className="text-right">{t('history.tokensHeader')}</TableHead>
                <TableHead aria-label={t('history.openAria')} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <HistoryRow key={item.id} item={item} onOpen={onOpen} />
              ))}
            </TableBody>
          </Table>
          <Pager
            offset={offset}
            total={total}
            count={items.length}
            onChange={(value) => updateFilters({ offset: value ? String(value) : undefined })}
          />
        </>
      )}
    </div>
  );
}

function HistoryRow({ item, onOpen }: { item: AuditEntrySummary; onOpen: (id: number) => void }) {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  return (
    <TableRow
      onClick={item.hasDetail ? () => onOpen(item.id) : undefined}
      className={cn(!item.hasDetail && 'hover:bg-transparent', item.hasDetail && 'cursor-pointer')}
    >
      <TableCell className={cn('font-medium', decisionTone(item.decision))}>
        {t(`auditDecisions.${decisionKey(item.decision)}`)}
      </TableCell>
      <TableCell>
        <DocumentLink documentId={item.documentId} />
      </TableCell>
      <TableCell className="w-full text-sm text-muted-foreground">
        {formatTime(item.createdAt)}
      </TableCell>
      <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
        {item.tokensCost != null ? item.tokensCost.toLocaleString() : ''}
      </TableCell>
      <TableCell className="text-right">
        {/* Row click covers the mouse; a real link supports keyboard navigation and opening a new tab. */}
        {item.hasDetail && (
          <TableAction asChild>
            <Link
              to={`/history/${item.id}${params.size ? `?${params}` : ''}`}
              onClick={(event) => event.stopPropagation()}
            >
              {t('history.view')}
            </Link>
          </TableAction>
        )}
      </TableCell>
    </TableRow>
  );
}

function Pager({
  offset,
  total,
  count,
  onChange,
}: {
  offset: number;
  total: number;
  count: number;
  onChange: (offset: number) => void;
}) {
  const { t } = useTranslation();
  const from = total === 0 ? 0 : offset + 1;
  const to = offset + count;
  const canPrev = offset > 0;
  const canNext = to < total;

  if (!canPrev && !canNext) {
    return <p className="text-xs text-muted-foreground">{t('history.runCount', { total })}</p>;
  }

  return (
    <div className="flex items-center justify-between">
      <p className="text-xs text-muted-foreground">{t('history.pager', { from, to, total })}</p>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={!canPrev}
          onClick={() => onChange(Math.max(0, offset - PAGE_SIZE))}
        >
          {t('history.previous')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!canNext}
          onClick={() => onChange(offset + PAGE_SIZE)}
        >
          {t('common.next')}
        </Button>
      </div>
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'cursor-pointer rounded-full border px-2.5 py-1 text-xs transition-colors',
        active
          ? 'border-primary bg-primary/10 text-foreground'
          : 'border-input text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
    </button>
  );
}

export function HistoryDetailPage() {
  const { id: rawId } = useParams();
  const id = Number(rawId);
  if (!rawId || !/^\d+$/.test(rawId) || !Number.isSafeInteger(id) || id < 1) {
    return <HistoryDetailError />;
  }
  return <HistoryDetailView id={id} />;
}

function HistoryDetailError({ onRetry }: { onRetry?: () => void }) {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  return (
    <div className="space-y-4">
      <p role="alert">{t('history.loadFailed')}</p>
      <div className="flex gap-2">
        {onRetry && (
          <Button variant="outline" onClick={onRetry}>
            {t('common.retry')}
          </Button>
        )}
        <Button asChild variant="ghost">
          <Link to={`/history${params.size ? `?${params}` : ''}`}>
            {t('history.backToHistory')}
          </Link>
        </Button>
      </div>
    </div>
  );
}

function HistoryDetailView({ id }: { id: number }) {
  const detail = useAuditDetail(id);
  const { t } = useTranslation();
  if (detail.isError) return <HistoryDetailError onRetry={() => void detail.refetch()} />;
  if (!detail.data) {
    return (
      <Loader2
        aria-label={t('app.loadingLabel')}
        className="mx-auto size-5 animate-spin text-muted-foreground"
      />
    );
  }
  return <HistoryDetail key={id} entry={detail.data} />;
}

function HistoryDetail({ entry }: { entry: AuditEntryDetail }) {
  const { t } = useTranslation();
  const parsed = extractionSchema.safeParse(entry.result);
  const result = parsed.success ? parsed.data : null;
  return (
    <div className="min-w-0 space-y-6">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className={cn('font-medium', decisionTone(entry.decision))}>
            {t(`auditDecisions.${decisionKey(entry.decision)}`)}
          </span>
          <span className="text-muted-foreground">{t('history.runLabel', { id: entry.id })}</span>
        </div>
        {result && (
          <h2 className="text-xl font-semibold tracking-tight break-words">{result.title}</h2>
        )}
        <dl className="grid grid-cols-2 gap-4 border-y py-4 text-sm sm:grid-cols-4">
          <RunFact label={t('history.documentHeader')}>
            <DocumentLink documentId={entry.documentId} />
          </RunFact>
          <RunFact label={t('history.whenHeader')}>{formatTime(entry.createdAt)}</RunFact>
          <RunFact label={t('history.jobHeader')}>
            {entry.jobId == null ? '—' : `#${entry.jobId}`}
          </RunFact>
          <RunFact label={t('history.tokensHeader')}>
            {entry.tokensCost?.toLocaleString() ?? '—'}
          </RunFact>
        </dl>
      </div>
      <PageSection title={t('history.responseTitle')}>
        <Block text={formatResponse(entry)} empty={t('history.responseEmpty')} />
      </PageSection>
      <PromptPreview text={entry.prompt} />
    </div>
  );
}

function RunFact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-words tabular-nums">{children}</dd>
    </div>
  );
}

function PromptPreview({ text }: { text: string | null }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  // Bound both prose and line-heavy prompts, including a single very long line.
  const preview = text?.split('\n').slice(0, 6).join('\n').slice(0, 600) ?? '';
  const canExpand = text != null && preview.length < text.length;

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <PageSection title={t('history.promptTitle')}>
        <div className="overflow-hidden rounded-lg [&_pre]:rounded-none">
          {!expanded && (
            <div className={canExpand ? 'max-h-40 overflow-hidden' : undefined}>
              <Block text={canExpand ? `${preview}…` : text} empty={t('history.promptEmpty')} />
            </div>
          )}
          <CollapsibleContent>
            <Block text={text} empty={t('history.promptEmpty')} />
          </CollapsibleContent>
          {canExpand && (
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="h-11 w-full rounded-none border-t bg-muted/40">
                {expanded ? t('history.collapsePrompt') : t('history.expandPrompt')}
                <ChevronDown
                  className={cn('size-4 transition-transform', expanded && 'rotate-180')}
                />
              </Button>
            </CollapsibleTrigger>
          )}
        </div>
      </PageSection>
    </Collapsible>
  );
}

function Block({ text, empty }: { text: string | null; empty: string }) {
  if (!text) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <pre
      tabIndex={0}
      className="rounded-lg bg-muted/40 p-4 font-mono text-sm leading-6 whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
    >
      {text}
    </pre>
  );
}

/** Prefer the literal stored output; pretty-print it when it's JSON. */
function formatResponse(entry: AuditEntryDetail): string | null {
  if (entry.rawOutput) {
    try {
      return JSON.stringify(JSON.parse(entry.rawOutput), null, 2);
    } catch {
      return entry.rawOutput;
    }
  }
  if (entry.result != null) return JSON.stringify(entry.result, null, 2);
  return null;
}
