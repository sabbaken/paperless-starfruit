import { Controller, Delete, HttpCode, Param, ParseIntPipe, Post } from '@nestjs/common';
import { QueueService } from './queue.service';

@Controller('jobs')
export class JobsController {
  constructor(private readonly queue: QueueService) {}

  /**
   * Clear the queue — delete every not-yet-started (`queued`) job. A `running`
   * job is left to finish and `done`/`failed` history is kept. Pair with the
   * pause toggle: while processing is active the poller re-enqueues tagged docs.
   */
  @Delete('queued')
  @HttpCode(204)
  clearQueue(): void {
    this.queue.clearQueued();
  }

  /**
   * Retry a terminally-failed document. `:documentId` is the document id every
   * dashboard job row carries — retry is per-document (it clears *all* failed
   * rows for the doc, then re-enqueues), which is what actually unblocks the
   * poller; clearing a single job-row id would leave the failure guard in place.
   */
  @Post(':documentId/retry')
  @HttpCode(204)
  retry(@Param('documentId', ParseIntPipe) documentId: number): void {
    this.queue.retryDocument(documentId);
  }
}
