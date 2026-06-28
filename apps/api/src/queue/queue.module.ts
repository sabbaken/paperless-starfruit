import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { QueueService } from './queue.service';

@Module({
  controllers: [JobsController],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
