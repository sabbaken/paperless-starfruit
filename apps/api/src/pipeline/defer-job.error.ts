/**
 * Thrown by the pipeline when a document can't be processed *yet* but isn't a
 * failure — most often paperless hasn't OCR'd it. The worker re-queues it for
 * the next poll without consuming a retry attempt (see `QueueService.defer`),
 * so a freshly-uploaded doc doesn't burn all its attempts before paperless has
 * even produced text.
 */
export class DeferJobError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeferJobError';
  }
}
