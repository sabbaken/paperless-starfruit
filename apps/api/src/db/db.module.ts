import { resolve } from 'node:path';
import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { createDb, type Db } from './client';

/** Injection token for the Drizzle database instance. */
export const DB = Symbol('DB');

@Global()
@Module({
  providers: [
    {
      provide: DB,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Db => {
        const path = config.get<string>('DATABASE_PATH') ?? './data/app.db';
        const db = createDb(path);
        // Apply pending migrations on boot so the schema is always present.
        // Idempotent (drizzle tracks applied migrations); resolved relative to
        // this file so it works regardless of the process cwd.
        const migrationsFolder =
          config.get<string>('DRIZZLE_DIR') ?? resolve(__dirname, '../../drizzle');
        migrate(db, { migrationsFolder });
        Logger.log(`migrations applied (${migrationsFolder})`, 'DbModule');
        return db;
      },
    },
  ],
  exports: [DB],
})
export class DbModule {}
