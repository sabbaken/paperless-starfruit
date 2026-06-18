import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { PollerService } from './poller.service';

@Module({
  imports: [QueueModule],
  providers: [PollerService],
})
export class PollerModule {}
