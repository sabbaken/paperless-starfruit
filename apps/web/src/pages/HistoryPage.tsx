import { useState } from 'react';
import { ArrowLeft, Loader2, Search, SearchX } from 'lucide-react';
import {
  AUDIT_DECISIONS,
  type AuditEntryDetail,
  type AuditEntrySummary,
} from '@paperless-starfruit/shared';
import { useAuditDetail, useAuditLog } from '@/api/audit';
import { useDebouncedCallback } from '@/hooks/use-debounced-callback';
import { useTranslation } from '@/i18n/I18nProvider';
import { cn } from '@/lib/utils';
import { DocumentLink } from '@/components/document-link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const PAGE_SIZE = 25;

const DECISION_TONE: Record<string, string> = {
  'auto-applied': 'text-emerald-600 dark:text-emerald-500',
  'review-queued': 'text-blue-600 dark:text-blue-400',
  'ocr-only': 'text-cyan-600 dark:text-cyan-400',
  approved: 'text-emerald-600 dark:text-emerald-500',
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
  const [openId, setOpenId] = useState<number | null>(null);

  if (openId != null) {
    return <HistoryDetailView id={openId} onClose={() => setOpenId(null)} />;
  }
  return <HistoryList onOpen={setOpenId} />;
}

function HistoryList({ onOpen }: { onOpen: (id: number) => void }) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [decision, setDecision] = useState<string | undefined>(undefined);
  const [offset, setOffset] = useState(0);

  // Debounce the free-text search so we don't fire a /audit request per keystroke;
  // the committed value (and a reset to page 1) lands 300ms after typing stops.
  const commitSearch = useDebouncedCallback(() => {
    setSearch(q.trim());
    setOffset(0);
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
          placeholder={t('history.searchPlaceholder')}
          className="pl-8"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Chip
          label={t('history.all')}
          active={!decision}
          onClick={() => {
            setDecision(undefined);
            setOffset(0);
          }}
        />
        {AUDIT_DECISIONS.map((d) => (
          <Chip
            key={d}
            label={t(`auditDecisions.${d}`)}
            active={decision === d}
            onClick={() => {
              setDecision(d);
              setOffset(0);
            }}
          />
        ))}
      </div>

      {log.isLoading ? (
        <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
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
          <div className="overflow-hidden rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">{t('history.decisionHeader')}</TableHead>
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
          </div>
          <Pager offset={offset} total={total} count={items.length} onChange={setOffset} />
        </>
      )}
    </div>
  );
}

function HistoryRow({ item, onOpen }: { item: AuditEntrySummary; onOpen: (id: number) => void }) {
  const { t } = useTranslation();
  return (
    <TableRow
      onClick={item.hasDetail ? () => onOpen(item.id) : undefined}
      className={cn(!item.hasDetail && 'hover:bg-transparent', item.hasDetail && 'cursor-pointer')}
    >
      <TableCell className={cn('py-3 pl-4 font-medium', decisionTone(item.decision))}>
        {t(`auditDecisions.${decisionKey(item.decision)}`)}
      </TableCell>
      <TableCell className="py-3">
        <DocumentLink documentId={item.documentId} />
      </TableCell>
      <TableCell className="w-full py-3 text-xs text-muted-foreground">
        {formatTime(item.createdAt)}
      </TableCell>
      <TableCell className="py-3 text-right text-xs tabular-nums text-muted-foreground">
        {item.tokensCost != null ? item.tokensCost.toLocaleString() : ''}
      </TableCell>
      <TableCell className="py-3 pr-4 text-right text-xs text-muted-foreground">
        {/* Row click covers the mouse; a real button keeps the detail reachable by keyboard. */}
        {item.hasDetail && (
          <button
            type="button"
            onClick={() => onOpen(item.id)}
            className="cursor-pointer hover:text-foreground"
          >
            {t('history.view')}
          </button>
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
      className={cn(
        'rounded-full border px-2.5 py-1 text-xs transition-colors',
        active
          ? 'border-primary bg-primary/10 text-foreground'
          : 'border-input text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
    </button>
  );
}

function HistoryDetailView({ id, onClose }: { id: number; onClose: () => void }) {
  const detail = useAuditDetail(id);

  if (detail.isLoading || !detail.data) {
    return <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />;
  }
  return <HistoryDetail entry={detail.data} onClose={onClose} />;
}

function HistoryDetail({ entry, onClose }: { entry: AuditEntryDetail; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onClose} className="-ml-2 text-muted-foreground">
        <ArrowLeft className="size-4" />
        {t('history.backToHistory')}
      </Button>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className={cn('font-medium', decisionTone(entry.decision))}>
          {t(`auditDecisions.${decisionKey(entry.decision)}`)}
        </span>
        <DocumentLink documentId={entry.documentId} />
        {entry.jobId != null && (
          <span className="text-muted-foreground">
            {t('history.jobLabel', { jobId: entry.jobId })}
          </span>
        )}
        {entry.tokensCost != null && (
          <span className="text-muted-foreground">
            {t('history.tokensLabel', { tokens: entry.tokensCost.toLocaleString() })}
          </span>
        )}
        <span className="text-muted-foreground">{formatTime(entry.createdAt)}</span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t('history.promptTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Block text={entry.prompt} empty={t('history.promptEmpty')} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t('history.responseTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Block text={formatResponse(entry)} empty={t('history.responseEmpty')} />
        </CardContent>
      </Card>
    </div>
  );
}

function Block({ text, empty }: { text: string | null; empty: string }) {
  if (!text) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <pre className="max-h-[28rem] overflow-auto rounded-md bg-muted/40 p-3 text-xs whitespace-pre-wrap text-muted-foreground">
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
