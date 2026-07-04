import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  ChevronRight,
  Inbox,
  ListTodo,
  Loader2,
  type LucideIcon,
  RotateCw,
  TriangleAlert,
} from 'lucide-react';
import type { JobSummary } from '@paperless-starfruit/shared';
import { useStats } from '@/api/stats';
import { useRetryJob } from '@/api/jobs';
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
  const navigate = useNavigate();
  const stats = useStats({ refetchInterval: 5000 });
  const retry = useRetryJob();

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
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Document pipeline
        </p>

        <div className="mt-4 grid grid-cols-2 gap-x-2 gap-y-5 sm:flex sm:items-stretch">
          <Stage
            icon={ListTodo}
            label="In queue"
            value={active}
            hint={`${queue.running} running`}
          />
          <StageArrow />
          <Stage
            icon={Inbox}
            label="Awaiting review"
            value={pendingReview}
            hint={pendingReview === 0 ? 'nothing to review' : undefined}
            action={
              pendingReview > 0 ? (
                <Button size="sm" variant="outline" className="h-7 px-2.5" onClick={() => navigate('/review')}>
                  Review
                </Button>
              ) : undefined
            }
          />
          <StageArrow />
          <Stage
            icon={CheckCircle2}
            label="Done"
            value={queue.done}
            tone={queue.done > 0 ? 'success' : undefined}
            hint={`${throughput} today`}
          />
          <div className="hidden self-stretch border-l sm:mx-4 sm:block" aria-hidden />
          <Stage
            icon={TriangleAlert}
            label="Failed"
            value={queue.failed}
            tone={queue.failed > 0 ? 'danger' : undefined}
            hint={queue.failed === 0 ? 'no failures' : undefined}
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
                  Retry all
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
                {queue.done} of {finished} succeeded
              </span>
              <span className={queue.failed > 0 ? 'text-destructive' : 'text-muted-foreground'}>
                {Math.round(errorRate * 100)}% error rate
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Metric label="Processed today" value={throughput} />
        <Metric label="Tokens used" value={tokenSpend.toLocaleString()} />
        <Metric
          label="Avg tokens per doc"
          value={queue.done > 0 ? Math.round(tokenSpend / queue.done).toLocaleString() : '—'}
        />
      </div>

      <PageSection title="Recent activity">
        {retry.error && (
          <p className="mb-2 text-sm text-destructive">
            {retry.error instanceof Error ? retry.error.message : 'Retry failed'}
          </p>
        )}
        {recentJobs.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No jobs yet. Tag a document in paperless with <code className="font-mono">psf-process</code> to get started.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">Status</TableHead>
                  <TableHead>Document</TableHead>
                  <TableHead className="w-full">Error</TableHead>
                  <TableHead className="text-right">Tokens</TableHead>
                  <TableHead aria-label="Actions" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentJobs.map((job) => (
                  <TableRow key={job.id} className="hover:bg-transparent">
                    <TableCell className={cn('py-3 pl-4 font-medium capitalize', STATUS_TONE[job.status])}>
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
                          Retry
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
