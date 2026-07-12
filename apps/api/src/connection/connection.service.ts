import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type {
  ConnectionStatus,
  ConnectionTestResult,
  PaperlessConnectionInput,
} from '@paperless-starfruit/shared';
import { DB } from '../db/db.module';
import type { Db } from '../db/client';
import { paperlessConnection } from '../db/schema';
import { CryptoService } from '../crypto/crypto.service';
import { PaperlessClient } from '../paperless/paperless.client';
import { PaperlessError } from '../paperless/paperless.error';

/** Last-resort pin when a server doesn't advertise X-Api-Version (current paperless = 7). */
const FALLBACK_API_VERSION = 7;

/**
 * Owns the single paperless-ngx connection: probing a candidate, persisting it
 * with the token encrypted at rest, and minting a typed client from the stored
 * row for the poller and pipeline.
 */
@Injectable()
export class ConnectionService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly crypto: CryptoService,
  ) {}

  /** Token-free status for the UI. */
  getStatus(): ConnectionStatus {
    const row = this.getRow();
    if (!row) return { connected: false };
    return { connected: true, baseUrl: row.baseUrl, apiVersion: row.apiVersion };
  }

  /** Probe a candidate connection without persisting it (the "Test" button). */
  async test(input: PaperlessConnectionInput): Promise<ConnectionTestResult> {
    const client = new PaperlessClient(input);
    try {
      const probe = await client.probe();
      return { ok: true, documentCount: probe.documentCount, version: probe.version };
    } catch (err) {
      return { ok: false, error: describeError(err) };
    }
  }

  /** Validate the connection, then store it (token encrypted). 400 if invalid. */
  async save(input: PaperlessConnectionInput): Promise<ConnectionStatus> {
    const client = new PaperlessClient(input);
    let probe;
    try {
      probe = await client.probe();
    } catch (err) {
      throw new BadRequestException(describeError(err));
    }

    // Pin the version the user chose, else the one the server reported, else a
    // sane fallback for the rare server that doesn't advertise one.
    const apiVersion = input.apiVersion ?? probe.apiVersion ?? FALLBACK_API_VERSION;
    const tokenEncrypted = this.crypto.encrypt(input.token);
    const existing = this.getRow();
    if (existing) {
      this.db
        .update(paperlessConnection)
        .set({ baseUrl: input.baseUrl, tokenEncrypted, apiVersion })
        .where(eq(paperlessConnection.id, existing.id))
        .run();
    } else {
      this.db
        .insert(paperlessConnection)
        .values({ baseUrl: input.baseUrl, tokenEncrypted, apiVersion })
        .run();
    }

    return { connected: true, baseUrl: input.baseUrl, apiVersion };
  }

  remove(): void {
    this.db.delete(paperlessConnection).run();
  }

  /** A client bound to the stored connection, or null if none is configured. */
  getClient(): PaperlessClient | null {
    const row = this.getRow();
    if (!row) return null;
    return new PaperlessClient({
      baseUrl: row.baseUrl,
      token: this.crypto.decrypt(row.tokenEncrypted),
      apiVersion: row.apiVersion,
    });
  }

  private getRow() {
    return (
      this.db
        .select()
        .from(paperlessConnection)
        .orderBy(paperlessConnection.id)
        .limit(1)
        .all()[0] ?? null
    );
  }
}

function describeError(err: unknown): string {
  if (err instanceof PaperlessError) {
    if (err.status === 401 || err.status === 403) {
      return 'Authentication failed. Check the API token.';
    }
    if (err.status === 406) {
      return 'This paperless does not support the chosen API version. Leave it blank to auto-detect.';
    }
    return err.message;
  }
  return err instanceof Error ? err.message : 'Unknown error while connecting.';
}
