import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DbModule } from './db/db.module';
import { CryptoModule } from './crypto/crypto.module';
import { ConnectionModule } from './connection/connection.module';
import { ProvidersModule } from './providers/providers.module';
import { QueueModule } from './queue/queue.module';
import { PollerModule } from './poller/poller.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    // In dev the API runs with cwd = apps/api, so also look up the repo-root
    // .env (where .env.example lives) to avoid a confusing missing-key error.
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    ScheduleModule.forRoot(),
    DbModule,
    CryptoModule,
    ConnectionModule,
    ProvidersModule,
    QueueModule,
    PollerModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
