import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConnectionService } from '../connection/connection.service';
import { SettingsService } from '../settings/settings.service';
import { TaxonomyService } from '../taxonomy/taxonomy.service';
import { ReviewService } from '../review/review.service';
import { QueueService } from '../queue/queue.service';

const MIN_INTERVAL_SEC = 15;

/**
 * Polls paperless-ngx for documents carrying the trigger tag and enqueues fresh
 * ones. Self-scheduling so it honours the configurable poll interval without a
 * fixed cron expression.
 */
@Injectable()
export class PollerService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(PollerService.name);
  private stopped = false;
  private timer?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly connection: ConnectionService,
    private readonly settings: SettingsService,
    private readonly taxonomy: TaxonomyService,
    private readonly review: ReviewService,
    private readonly queue: QueueService,
  ) {}

  onApplicationBootstrap(): void {
    this.schedule(0);
  }

  onModuleDestroy(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }

  /**
   * One poll cycle: enqueue tagged documents that aren't already in flight or
   * awaiting review. Returns the number of newly-enqueued documents.
   */
  async pollOnce(): Promise<number> {
    const client = this.connection.getClient();
    if (!client) {
      this.logger.debug('no paperless connection; skipping poll');
      return 0;
    }

    const triggerTagId = await this.taxonomy.resolveTriggerTag(client);
    const { results } = await client.listDocuments({
      tagIds: [triggerTagId],
      ordering: 'added',
    });

    let enqueued = 0;
    for (const doc of results) {
      // A pending review item means we already processed it and are waiting on
      // the user; don't re-enqueue (the trigger tag stays until they decide).
      if (this.review.hasPending(doc.id)) continue;
      // A terminally-failed job keeps its trigger tag too; without this guard
      // we'd re-enqueue (and re-spend on the LLM) every cycle forever. Re-tagging
      // does NOT clear this; the `failed` rows persist regardless of the tag.
      // Use the dashboard "Retry" action (POST /jobs/:documentId/retry) to drop
      // those rows and reprocess after fixing the cause.
      if (this.queue.hasTerminalFailure(doc.id)) continue;
      if (this.queue.enqueue(doc.id)) enqueued++;
    }
    if (enqueued > 0) this.logger.log(`enqueued ${enqueued} document(s)`);
    return enqueued;
  }

  private schedule(delayMs: number): void {
    if (this.stopped) return;
    this.timer = setTimeout(() => void this.tick(), delayMs);
  }

  private async tick(): Promise<void> {
    let intervalSec = MIN_INTERVAL_SEC;
    try {
      const s = this.settings.get();
      intervalSec = s.pollIntervalSec;
      // Paused: skip enqueuing but keep rescheduling so polling resumes on unpause.
      if (!s.paused) await this.pollOnce();
    } catch (err) {
      this.logger.warn(`poll failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      this.schedule(Math.max(MIN_INTERVAL_SEC, intervalSec) * 1000);
    }
  }
}
