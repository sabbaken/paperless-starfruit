import { Module } from '@nestjs/common';
import { ConnectionModule } from '../connection/connection.module';
import { SettingsModule } from '../settings/settings.module';
import { TaxonomyModule } from '../taxonomy/taxonomy.module';
import { AuditModule } from '../audit/audit.module';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';

@Module({
  imports: [ConnectionModule, SettingsModule, TaxonomyModule, AuditModule],
  controllers: [ReviewController],
  providers: [ReviewService],
  exports: [ReviewService],
})
export class ReviewModule {}
