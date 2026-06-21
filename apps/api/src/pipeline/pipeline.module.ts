import { Module } from '@nestjs/common';
import { ConnectionModule } from '../connection/connection.module';
import { ProvidersModule } from '../providers/providers.module';
import { SettingsModule } from '../settings/settings.module';
import { PromptsModule } from '../prompts/prompts.module';
import { TaxonomyModule } from '../taxonomy/taxonomy.module';
import { ReviewModule } from '../review/review.module';
import { QueueModule } from '../queue/queue.module';
import { AuditModule } from '../audit/audit.module';
import { PipelineService } from './pipeline.service';
import { WorkerService } from './worker.service';

/** The extraction pipeline + the in-process worker that drives it. */
@Module({
  imports: [
    ConnectionModule,
    ProvidersModule,
    SettingsModule,
    PromptsModule,
    TaxonomyModule,
    ReviewModule,
    QueueModule,
    AuditModule,
  ],
  providers: [PipelineService, WorkerService],
  exports: [PipelineService],
})
export class PipelineModule {}
