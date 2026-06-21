import { Module } from '@nestjs/common';
import { ConnectionModule } from '../connection/connection.module';
import { ProvidersModule } from '../providers/providers.module';
import { SettingsModule } from '../settings/settings.module';
import { TaxonomyModule } from '../taxonomy/taxonomy.module';
import { PromptsController } from './prompts.controller';
import { PromptsService } from './prompts.service';
import { PromptTestService } from './prompt-test.service';

/** Editable prompts: persistence (overrides-or-default) + test-on-a-document. */
@Module({
  imports: [ConnectionModule, ProvidersModule, SettingsModule, TaxonomyModule],
  controllers: [PromptsController],
  providers: [PromptsService, PromptTestService],
  exports: [PromptsService],
})
export class PromptsModule {}
