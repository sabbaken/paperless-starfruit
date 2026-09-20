import { Module } from '@nestjs/common';
import { ConnectionModule } from '../connection/connection.module';
import { HiddenTagsService } from './hidden-tags.service';
import { TagCommentsService } from './tag-comments.service';
import { TagsController } from './tags.controller';
import { TaxonomyService } from './taxonomy.service';
import { DocumentTypesController } from './document-types.controller';
import { DocumentTypeCommentsService } from './document-type-comments.service';
import { HiddenDocumentTypesService } from './hidden-document-types.service';

/**
 * Shared taxonomy cache + reconciliation (poller, pipeline) plus the Tags
 * admin surface: paperless tag CRUD and the local per-tag AI hints.
 */
@Module({
  imports: [ConnectionModule],
  controllers: [TagsController, DocumentTypesController],
  providers: [
    TaxonomyService,
    TagCommentsService,
    HiddenTagsService,
    DocumentTypeCommentsService,
    HiddenDocumentTypesService,
  ],
  exports: [
    TaxonomyService,
    TagCommentsService,
    HiddenTagsService,
    DocumentTypeCommentsService,
    HiddenDocumentTypesService,
  ],
})
export class TaxonomyModule {}
