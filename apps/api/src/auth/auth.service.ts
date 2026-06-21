import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { AuthResult, LoginInput, RegisterInput } from '@paperless-starfruit/shared';
import { DB } from '../db/db.module';
import type { Db } from '../db/client';
import { user, type User } from '../db/schema';
import { CryptoService } from '../crypto/crypto.service';
import { hashPassword, verifyPassword } from './password';
import { signToken, verifyToken } from './token';

/** Logged-in principal attached to the request by the guard. */
export interface AuthUser {
  username: string;
}

const TOKEN_TTL_SEC = 7 * 24 * 60 * 60; // 7 days

/**
 * Single-admin auth. The first-run setup claims the instance by creating the one
 * account; afterwards registration is closed and only login works. Sessions are
 * stateless HS256 tokens signed with a key derived from `ENCRYPTION_KEY`.
 */
@Injectable()
export class AuthService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly crypto: CryptoService,
  ) {}

  /** Has the instance been claimed (an admin exists)? */
  hasAdmin(): boolean {
    return this.db.select({ id: user.id }).from(user).limit(1).all().length > 0;
  }

  /** First-run setup. Fails once an admin already exists. */
  register(input: RegisterInput): AuthResult {
    if (this.hasAdmin()) {
      throw new ConflictException('An admin account already exists.');
    }
    const username = input.username.trim();
    const [row] = this.db
      .insert(user)
      .values({ username, passwordHash: hashPassword(input.password) })
      .returning()
      .all();
    return this.issue(row);
  }

  login(input: LoginInput): AuthResult {
    const username = input.username.trim();
    const row = this.db.select().from(user).where(eq(user.username, username)).all()[0];
    // Verify even when the user is missing? Not worth it for a single-admin app;
    // the timing gap leaks only "is the instance claimed", which /auth/status
    // already exposes publicly.
    if (!row || !verifyPassword(input.password, row.passwordHash)) {
      throw new UnauthorizedException('Invalid username or password.');
    }
    return this.issue(row);
  }

  /** Validate a bearer token; returns the principal or null. */
  verify(token: string): AuthUser | null {
    const claims = verifyToken(token, this.signingKey());
    return claims ? { username: claims.sub } : null;
  }

  private issue(row: User): AuthResult {
    return { token: signToken(row.username, this.signingKey(), TOKEN_TTL_SEC), username: row.username };
  }

  private signingKey(): Buffer {
    return this.crypto.deriveKey('auth-session-token');
  }
}
