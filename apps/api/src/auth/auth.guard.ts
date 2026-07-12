import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthService, type AuthUser } from './auth.service';
import { IS_PUBLIC } from './public.decorator';

/**
 * Global guard: every route requires a valid bearer token unless marked
 * `@Public()` (health, the auth bootstrap routes). Registered as an APP_GUARD,
 * so the whole API (including credential reads/writes) is locked by default.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
    if (!token) throw new UnauthorizedException('Authentication required.');

    const user = this.auth.verify(token);
    if (!user) throw new UnauthorizedException('Invalid or expired session.');

    req.user = user;
    return true;
  }
}
