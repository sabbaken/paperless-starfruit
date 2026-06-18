import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { QueueService } from '../queue/queue.service';

/**
 * Polls paperless-ngx for documents carrying the trigger tag and enqueues them.
 * M0 scaffold: the cron is wired but the paperless lookup lands in M1.
 */
@Injectable()
export class PollerService {
  private readonly logger = new Logger(PollerService.name);

  constructor(private readonly queue: QueueService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  poll(): void {
    // M1: resolve trigger-tag id -> list tagged docs -> this.queue.enqueue(id)
    this.logger.debug('poll tick (scaffold no-op)');
  }
}
