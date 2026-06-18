import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { QueueService } from '../queue/queue.service';
import type { Job } from '../db/schema';
import { PipelineService } from './pipeline.service';

/** How long to wait before re-checking an empty queue. */
const IDLE_MS = 1_500;

/**
 * In-process worker: claims queued jobs one at a time and runs the pipeline.
 * Concurrency is 1 by design — a single user at ~7 docs/day, and serial work
 * avoids hammering paperless (PATCH triggers re-index + CPU spikes).
 */
@Injectable()
export class WorkerService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(WorkerService.name);
  private stopped = false;
  private wake?: () => void;

  constructor(
    private readonly queue: QueueService,
    private readonly pipeline: PipelineService,
  ) {}

  onApplicationBootstrap(): void {
    void this.loop();
  }

  onModuleDestroy(): void {
    this.stopped = true;
    this.wake?.();
  }

  private async loop(): Promise<void> {
    this.logger.log('worker started');
    while (!this.stopped) {
      let job: Job | null = null;
      try {
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
      await this.runJob(job);
    }
    this.logger.log('worker stopped');
  }

  /** Run one claimed job and settle it (done/failed). Never throws. */
  async runJob(job: Job): Promise<void> {
    try {
      const result = await this.pipeline.process(job);
      this.queue.complete(job.id, result.contentHash, result.cost ?? undefined);
      this.logger.log(`job ${job.id} (doc ${job.documentId}): ${result.decision}`);
    } catch (err) {
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
