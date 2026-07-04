import { Module } from '@nestjs/common';
import { ConnectionModule } from '../connection/connection.module';
import { TagCommentsService } from './tag-comments.service';
import { TagsController } from './tags.controller';
import { TaxonomyService } from './taxonomy.service';

/**
 * Shared taxonomy cache + reconciliation (poller, pipeline) plus the Tags
 * admin surface: paperless tag CRUD and the local per-tag AI hints.
 */
@Module({
  imports: [ConnectionModule],
  controllers: [TagsController],
  providers: [TaxonomyService, TagCommentsService],
  exports: [TaxonomyService, TagCommentsService],
})
export class TaxonomyModule {}
