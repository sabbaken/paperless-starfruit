import { Module } from '@nestjs/common';
import { TaxonomyService } from './taxonomy.service';

/** Shared taxonomy cache + reconciliation, used by both the poller and pipeline. */
@Module({
  providers: [TaxonomyService],
  exports: [TaxonomyService],
})
export class TaxonomyModule {}
