import { Module } from '@nestjs/common';
import { ConnectionModule } from '../connection/connection.module';
import { SettingsModule } from '../settings/settings.module';
import { TaxonomyModule } from '../taxonomy/taxonomy.module';
import { ReviewModule } from '../review/review.module';
import { QueueModule } from '../queue/queue.module';
import { PollerService } from './poller.service';

@Module({
  imports: [ConnectionModule, SettingsModule, TaxonomyModule, ReviewModule, QueueModule],
  providers: [PollerService],
})
export class PollerModule {}
