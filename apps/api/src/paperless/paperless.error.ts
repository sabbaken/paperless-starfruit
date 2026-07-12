/** Raised when a paperless-ngx request fails: network error or non-2xx response. */
export class PaperlessError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly body?: string,
  ) {
    super(message);
    this.name = 'PaperlessError';
  }
}
