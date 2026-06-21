import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

/**
 * Per-IP fixed-window rate limit for the credential endpoints (login/register)
 * to blunt brute force. In-memory and singleton-scoped — fine for a single
 * self-hosted instance; no Redis, no `@nestjs/throttler` dependency.
 */
@Injectable()
export class LoginThrottleGuard implements CanActivate {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();
  private readonly limit = 10;
  private readonly windowMs = 60_000;

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
    const now = Date.now();
    const entry = this.hits.get(ip);

    if (!entry || now > entry.resetAt) {
      this.hits.set(ip, { count: 1, resetAt: now + this.windowMs });
      this.sweep(now);
      return true;
    }
    if (entry.count >= this.limit) {
      throw new HttpException('Too many attempts — wait a minute.', HttpStatus.TOO_MANY_REQUESTS);
    }
    entry.count += 1;
    return true;
  }

  /** Drop expired windows so the map can't grow unbounded. */
  private sweep(now: number): void {
    for (const [ip, entry] of this.hits) {
      if (now > entry.resetAt) this.hits.delete(ip);
    }
  }
}
