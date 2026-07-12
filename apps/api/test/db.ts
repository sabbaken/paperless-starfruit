import { resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '../src/db/schema';
import type { Db } from '../src/db/client';

/**
 * A fresh in-memory database with all migrations applied, for unit tests.
 * Lives outside `src/` so the production build never compiles it.
 */
export function createTestDb(): Db {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  // This file is at apps/api/test/, so ../drizzle resolves to apps/api/drizzle.
  migrate(db, { migrationsFolder: resolve(__dirname, '../drizzle') });
  return db;
}
