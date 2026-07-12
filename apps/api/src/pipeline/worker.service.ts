import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { QueueService } from '../queue/queue.service';
import { SettingsService } from '../settings/settings.service';
import type { Job } from '../db/schema';
import { PipelineService } from './pipeline.service';
import { DeferJobError } from './defer-job.error';

/** How long to wait before re-checking an empty queue. */
const IDLE_MS = 1_500;

/**
 * In-process worker: claims queued jobs one at a time and runs the pipeline.
 * Concurrency is 1 by design: a single user at ~7 docs/day, and serial work
 * avoids hammering paperless (PATCH triggers re-index + CPU spikes).
 */
@Injectable()
export class WorkerService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(WorkerService.name);
  private stopped = false;
  private wake?: () => void;
  /** The in-flight job's promise + its abort handle, so shutdown can drain it. */
  private running?: Promise<void>;
  private abort?: AbortController;

  constructor(
    private readonly queue: QueueService,
    private readonly pipeline: PipelineService,
    private readonly settings: SettingsService,
  ) {}

  onApplicationBootstrap(): void {
    // Reclaim jobs a previous crash left stuck in `running` before we start
    // claiming; otherwise they're orphaned (claimNext only sees `queued`) and
    // their active-per-doc slot blocks the poller from ever re-enqueuing them.
    try {
      const n = this.queue.recoverRunning();
      if (n > 0) this.logger.warn(`recovered ${n} job(s) stuck in running`);
    } catch (err) {
      this.logger.error(`failed to recover running jobs: ${message(err)}`);
    }
    void this.loop();
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    this.abort?.abort(); // cancel an in-flight LLM call
    this.wake?.(); // break out of an idle sleep
    await this.running; // runJob never throws, so this always settles
  }

  private async loop(): Promise<void> {
    this.logger.log('worker started');
    while (!this.stopped) {
      let job: Job | null = null;
      try {
        // Paused: don't drain the backlog either; idle until unpaused. Any job
        // already claimed above finishes; only new claims are held back.
        if (this.settings.get().paused) {
          await this.idle();
          continue;
        }
        job = this.queue.claimNext();
      } catch (err) {
        this.logger.error(`failed to claim a job: ${message(err)}`);
        await this.idle();
        continue;
      }
      if (!job) {
        await this.idle();
        continue;
      }
      this.abort = new AbortController();
      this.running = this.runJob(job, this.abort.signal);
      await this.running;
      this.running = undefined;
    }
    this.logger.log('worker stopped');
  }

  /** Run one claimed job and settle it (done/failed/deferred). Never throws. */
  async runJob(job: Job, signal?: AbortSignal): Promise<void> {
    try {
      const result = await this.pipeline.process(job, signal);
      this.queue.complete(job.id, result.contentHash, result.cost ?? undefined);
      this.logger.log(`job ${job.id} (doc ${job.documentId}): ${result.decision}`);
    } catch (err) {
      // The doc isn't ready (e.g. not OCR'd yet); wait for the next poll
      // without burning an attempt.
      if (err instanceof DeferJobError) {
        this.queue.defer(job.id);
        this.logger.debug(`job ${job.id} (doc ${job.documentId}) deferred: ${err.message}`);
        return;
      }
      // Cancelled by shutdown, not the job's fault; re-queue it for next boot
      // without consuming an attempt.
      if (signal?.aborted) {
        this.queue.defer(job.id);
        this.logger.log(`job ${job.id} (doc ${job.documentId}) deferred (shutting down)`);
        return;
      }
      this.queue.fail(job.id, message(err));
      this.logger.warn(`job ${job.id} (doc ${job.documentId}) failed: ${message(err)}`);
    }
  }

  /** Sleep until the idle timeout, or resolve immediately when stopping. */
  private idle(): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, IDLE_MS);
      this.wake = () => {
        clearTimeout(timer);
        resolve();
      };
    });
  }
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
