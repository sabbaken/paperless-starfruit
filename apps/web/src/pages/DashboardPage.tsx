import { useNavigate } from 'react-router-dom';
import { Loader2, RotateCw } from 'lucide-react';
import type { JobSummary } from '@paperless-starfruit/shared';
import { useStats } from '@/api/stats';
import { useRetryJob } from '@/api/jobs';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageSection } from '@/components/ui/page-section';

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
        <Stat label="In queue" value={active} hint={`${queue.running} running`} />
        <Stat
          label="Awaiting review"
          value={pendingReview}
          action={pendingReview > 0 ? <Button size="sm" variant="outline" onClick={() => navigate('/review')}>Review</Button> : undefined}
        />
        <Stat label="Processed" value={queue.done} hint={queue.failed ? `${queue.failed} failed` : undefined} hintTone={queue.failed ? 'fault' : undefined} />
        <Stat label="Processed (24h)" value={throughput} hint="completed today" />
        <Stat
          label="Error rate"
          value={`${Math.round(errorRate * 100)}%`}
          hint={finished > 0 ? `${queue.failed} of ${finished} finished` : 'no jobs finished yet'}
        />
        <Stat label="Tokens used" value={tokenSpend.toLocaleString()} />
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
          <ul className="divide-y">
            {recentJobs.map((job) => (
              <li key={job.id} className="flex items-center gap-3 py-2.5 text-sm">
                <span className={cn('w-16 shrink-0 font-medium capitalize', STATUS_TONE[job.status])}>
                  {job.status}
                </span>
                <span className="shrink-0 text-muted-foreground">doc #{job.documentId}</span>
                <span className="min-w-0 flex-1 truncate text-destructive">{job.error ?? ''}</span>
                {job.cost != null && (
                  <Badge variant="outline" className="shrink-0 font-mono">
                    {job.cost.toLocaleString()} tok
                  </Badge>
                )}
                {job.status === 'failed' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 shrink-0 px-2"
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
              </li>
            ))}
          </ul>
        )}
      </PageSection>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  hintTone,
  action,
}: {
  label: string;
  value: number | string;
  hint?: string;
  hintTone?: 'fault';
  action?: React.ReactNode;
}) {
  return (
    <div className="space-y-1 rounded-lg bg-muted/50 p-4">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
        {action}
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
