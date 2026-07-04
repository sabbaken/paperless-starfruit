import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Coins,
  Inbox,
  ListTodo,
  Loader2,
  type LucideIcon,
  RotateCw,
  TrendingUp,
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

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat label="In queue" icon={ListTodo} value={active} hint={`${queue.running} running`} />
        <Stat
          label="Awaiting review"
          icon={Inbox}
          value={pendingReview}
          action={pendingReview > 0 ? <Button size="sm" variant="outline" onClick={() => navigate('/review')}>Review</Button> : undefined}
        />
        <Stat label="Processed" icon={CheckCircle2} value={queue.done} hint={queue.failed ? `${queue.failed} failed` : undefined} hintTone={queue.failed ? 'fault' : undefined} />
        <Stat label="Processed (24h)" icon={TrendingUp} value={throughput} hint="completed today" />
        <Stat
          label="Error rate"
          icon={TriangleAlert}
          value={`${Math.round(errorRate * 100)}%`}
          hint={finished > 0 ? `${queue.failed} of ${finished} finished` : 'no jobs finished yet'}
        />
        <Stat label="Tokens used" icon={Coins} value={tokenSpend.toLocaleString()} />
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

function Stat({
  label,
  icon: Icon,
  value,
  hint,
  hintTone,
  action,
}: {
  label: string;
  icon: LucideIcon;
  value: number | string;
  hint?: string;
  hintTone?: 'fault';
  action?: React.ReactNode;
}) {
  return (
    <div className="space-y-1 rounded-lg bg-muted/50 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
        <div className="flex shrink-0 items-center gap-2">
          {action}
          <Icon className="size-4 text-muted-foreground" />
        </div>
      </div>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      {hint && (
        <p className={cn('text-xs', hintTone === 'fault' ? 'text-destructive' : 'text-muted-foreground')}>
          {hint}
        </p>
      )}
    </div>
  );
}
