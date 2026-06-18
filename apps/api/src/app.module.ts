import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DbModule } from './db/db.module';
import { QueueModule } from './queue/queue.module';
import { PollerModule } from './poller/poller.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    DbModule,
    QueueModule,
    PollerModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
