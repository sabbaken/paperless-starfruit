import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Minimal HS256 JWT (sign + verify) over `node:crypto`, with no jsonwebtoken
 * dependency, in keeping with this app's hand-rolled, single-container style.
 * The algorithm is hardcoded (no header-driven alg selection), so the classic
 * "alg=none" / algorithm-confusion attacks don't apply, and the signature is
 * compared in constant time.
 */
export interface TokenClaims {
  /** Subject: the admin username. */
  sub: string;
  /** Issued-at / expiry, epoch seconds. */
  iat: number;
  exp: number;
}

const HEADER = b64url(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));

export function signToken(sub: string, key: Buffer, ttlSec: number): string {
  const now = Math.floor(Date.now() / 1000);
  const claims: TokenClaims = { sub, iat: now, exp: now + ttlSec };
  const body = b64url(Buffer.from(JSON.stringify(claims)));
  const data = `${HEADER}.${body}`;
  return `${data}.${sign(data, key)}`;
}

export function verifyToken(token: string, key: Buffer): TokenClaims | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;

  const expected = Buffer.from(sign(`${header}.${body}`, key), 'utf8');
  const given = Buffer.from(sig, 'utf8');
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  try {
    const claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as TokenClaims;
    if (typeof claims.exp !== 'number' || claims.exp < Math.floor(Date.now() / 1000)) return null;
    if (typeof claims.sub !== 'string' || !claims.sub) return null;
    return claims;
  } catch {
    return null;
  }
}

function sign(data: string, key: Buffer): string {
  return b64url(createHmac('sha256', key).update(data).digest());
}

function b64url(buf: Buffer): string {
  return buf.toString('base64url');
}
