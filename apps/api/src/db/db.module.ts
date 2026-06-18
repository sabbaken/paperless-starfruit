import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
        return createDb(path);
      },
    },
  ],
  exports: [DB],
})
export class DbModule {}
