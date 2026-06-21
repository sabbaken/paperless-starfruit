import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DbModule } from './db/db.module';
import { CryptoModule } from './crypto/crypto.module';
import { AuthModule } from './auth/auth.module';
import { ConnectionModule } from './connection/connection.module';
import { ProvidersModule } from './providers/providers.module';
import { SettingsModule } from './settings/settings.module';
import { PromptsModule } from './prompts/prompts.module';
import { TaxonomyModule } from './taxonomy/taxonomy.module';
import { AuditModule } from './audit/audit.module';
import { ReviewModule } from './review/review.module';
import { PipelineModule } from './pipeline/pipeline.module';
import { StatsModule } from './stats/stats.module';
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
    AuthModule,
    ConnectionModule,
    ProvidersModule,
    SettingsModule,
    PromptsModule,
    TaxonomyModule,
    AuditModule,
    ReviewModule,
    QueueModule,
    PipelineModule,
    StatsModule,
    PollerModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
