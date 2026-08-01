import { useState } from 'react';
import { useNavigate } from 'react-router';
import toast from 'react-hot-toast';
import {
  CheckCircle2,
  ChevronRight,
  Inbox,
  ListTodo,
  Loader2,
  type LucideIcon,
  Pause,
  Play,
  RotateCw,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import type { JobSummary } from '@paperless-starfruit/shared';
import { useStats } from '@/api/stats';
import { useClearQueue, useRetryJob } from '@/api/jobs';
import { useSettings, useUpdateSettings } from '@/api/settings';
import { useTranslation } from '@/i18n/I18nProvider';
import { cn } from '@/lib/utils';
import { DocumentLink } from '@/components/document-link';
import { Button } from '@/components/ui/button';
import { PageSection } from '@/components/ui/page-section';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const STATUS_TONE: Record<JobSummary['status'], string> = {
  queued: 'text-muted-foreground',
  running: 'text-blue-600 dark:text-blue-400',
  done: 'text-emerald-600 dark:text-emerald-500',
  failed: 'text-destructive',
};

export function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const stats = useStats({ refetchInterval: 5000 });
  const settings = useSettings();
  const updateSettings = useUpdateSettings();
  const clearQueue = useClearQueue();
  const retry = useRetryJob();
  const [confirmingClear, setConfirmingClear] = useState(false);

  const paused = settings.data?.paused ?? false;

  const togglePaused = () => {
    const next = !paused;
    void toast.promise(updateSettings.mutateAsync({ paused: next }), {
      loading: t('common.saving'),
      success: next ? t('dashboard.processingPaused') : t('dashboard.processingResumed'),
      error: (e) => (e instanceof Error ? e.message : t('common.saveFailed')),
    });
  };

  const handleClearQueue = () => {
    setConfirmingClear(false);
    void toast.promise(clearQueue.mutateAsync(), {
      loading: t('dashboard.clearing'),
      success: t('dashboard.queueCleared'),
      error: (e) => (e instanceof Error ? e.message : t('dashboard.clearQueueFailed')),
    });
  };

  if (stats.isLoading || !stats.data) {
    return <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />;
  }

  const { queue, pendingReview, tokenSpend, throughput, errorRate, recentJobs } = stats.data;
  const active = queue.queued + queue.running;
  const finished = queue.done + queue.failed;
  const failedDocIds = [
    ...new Set(recentJobs.filter((j) => j.status === 'failed').map((j) => j.documentId)),
  ];

  return (
    <div className="space-y-8">
      <div className="rounded-xl border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {t('dashboard.pipeline')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={paused ? 'default' : 'outline'}
              className="h-7 px-2.5"
              disabled={!settings.data || updateSettings.isPending}
              onClick={togglePaused}
            >
              {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
              {paused ? t('dashboard.resume') : t('dashboard.pause')}
            </Button>
            {confirmingClear ? (
              <>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7 px-2.5"
                  disabled={clearQueue.isPending}
                  onClick={handleClearQueue}
                >
                  {t('dashboard.confirmClear')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2.5"
                  onClick={() => setConfirmingClear(false)}
                >
                  {t('common.cancel')}
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2.5"
                disabled={queue.queued === 0 || clearQueue.isPending}
                onClick={() => setConfirmingClear(true)}
              >
                <Trash2 className="size-3.5" />
                {t('dashboard.clearQueue')}
              </Button>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-x-2 gap-y-5 sm:flex sm:items-stretch">
          <Stage
            icon={ListTodo}
            label={t('dashboard.inQueue')}
            value={active}
            hint={t('dashboard.runningHint', { count: queue.running })}
          />
          <StageArrow />
          <Stage
            icon={Inbox}
            label={t('dashboard.awaitingReview')}
            value={pendingReview}
            hint={pendingReview === 0 ? t('dashboard.nothingToReview') : undefined}
            action={
              pendingReview > 0 ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2.5"
                  onClick={() => navigate('/review')}
                >
                  {t('dashboard.review')}
                </Button>
              ) : undefined
            }
          />
          <StageArrow />
          <Stage
            icon={CheckCircle2}
            label={t('common.done')}
            value={queue.done}
            tone={queue.done > 0 ? 'success' : undefined}
            hint={t('dashboard.todayHint', { count: throughput })}
          />
          <div className="hidden self-stretch border-l sm:mx-4 sm:block" aria-hidden />
          <Stage
            icon={TriangleAlert}
            label={t('dashboard.failed')}
            value={queue.failed}
            tone={queue.failed > 0 ? 'danger' : undefined}
            hint={queue.failed === 0 ? t('dashboard.noFailures') : undefined}
            action={
              failedDocIds.length > 0 ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2.5"
                  disabled={retry.isPending}
                  onClick={() => failedDocIds.forEach((id) => retry.mutate(id))}
                >
                  {retry.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <RotateCw className="size-3.5" />
                  )}
                  {t('dashboard.retryAll')}
                </Button>
              ) : undefined
            }
          />
        </div>

        {finished > 0 && (
          <div className="mt-6">
            <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="bg-emerald-500 transition-[width] duration-500"
                style={{ width: `${(queue.done / finished) * 100}%` }}
              />
              <div
                className="bg-destructive transition-[width] duration-500"
                style={{ width: `${(queue.failed / finished) * 100}%` }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {t('dashboard.succeeded', { done: queue.done, finished })}
              </span>
              <span className={queue.failed > 0 ? 'text-destructive' : 'text-muted-foreground'}>
                {t('dashboard.errorRate', { pct: Math.round(errorRate * 100) })}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Metric label={t('dashboard.processedToday')} value={throughput} />
        <Metric label={t('dashboard.tokensUsed')} value={tokenSpend.toLocaleString()} />
        <Metric
          label={t('dashboard.avgTokensPerDoc')}
          value={queue.done > 0 ? Math.round(tokenSpend / queue.done).toLocaleString() : '—'}
        />
      </div>

      <PageSection title={t('dashboard.recentActivity')}>
        {retry.error && (
          <p className="mb-2 text-sm text-destructive">
            {retry.error instanceof Error ? retry.error.message : t('dashboard.retryFailed')}
          </p>
        )}
        {recentJobs.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t('dashboard.recentEmptyPrefix')} <code className="font-mono">psf-process</code>
            {t('dashboard.recentEmptySuffix')}
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">{t('dashboard.statusHeader')}</TableHead>
                  <TableHead>{t('dashboard.documentHeader')}</TableHead>
                  <TableHead className="w-full">{t('dashboard.errorHeader')}</TableHead>
                  <TableHead className="text-right">{t('dashboard.tokensHeader')}</TableHead>
                  <TableHead aria-label={t('dashboard.actionsLabel')} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentJobs.map((job) => (
                  <TableRow key={job.id} className="hover:bg-transparent">
                    <TableCell
                      className={cn('py-3 pl-4 font-medium capitalize', STATUS_TONE[job.status])}
                    >
                      {job.status}
                    </TableCell>
                    <TableCell className="py-3">
                      <DocumentLink documentId={job.documentId} />
                    </TableCell>
                    <TableCell className="w-full max-w-0 py-3">
                      <p className="truncate text-destructive" title={job.error ?? undefined}>
                        {job.error ?? ''}
                      </p>
                    </TableCell>
                    <TableCell className="py-3 text-right text-xs tabular-nums text-muted-foreground">
                      {job.cost != null ? job.cost.toLocaleString() : ''}
                    </TableCell>
                    <TableCell className="py-0 pr-2 text-right">
                      {job.status === 'failed' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2"
                          disabled={retry.isPending}
                          onClick={() => retry.mutate(job.documentId)}
                        >
                          {retry.isPending && retry.variables === job.documentId ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <RotateCw className="size-3.5" />
                          )}
                          {t('common.retry')}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </PageSection>
    </div>
  );
}

function Stage({
  icon: Icon,
  label,
  value,
  hint,
  tone,
  action,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  hint?: string;
  tone?: 'success' | 'danger';
  action?: React.ReactNode;
}) {
  return (
    <div className="min-w-0 flex-1">
      <p
        className={cn(
          'flex items-center gap-1.5 text-xs font-medium',
          tone === 'danger' ? 'text-destructive' : 'text-muted-foreground',
        )}
      >
        <Icon className="size-3.5 shrink-0" />
        {label}
      </p>
      <p
        className={cn(
          'mt-1 text-2xl font-semibold tabular-nums',
          tone === 'success' && 'text-emerald-600 dark:text-emerald-500',
          tone === 'danger' && 'text-destructive',
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      {action && <div className="mt-1.5">{action}</div>}
    </div>
  );
}

function StageArrow() {
  return (
    <ChevronRight
      className="hidden size-4 shrink-0 self-center text-muted-foreground/50 sm:mx-2 sm:block"
      aria-hidden
    />
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    // Same chrome as the pipeline card above, so the tiles read as one family.
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
