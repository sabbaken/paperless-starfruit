import { Module } from '@nestjs/common';
import { ProviderController } from './provider.controller';
import { ProviderService } from './provider.service';
import { LlmService } from './llm.service';

/** LLM/OCR provider configuration + the structured-output engine. */
@Module({
  controllers: [ProviderController],
  providers: [ProviderService, LlmService],
  exports: [ProviderService, LlmService],
})
export class ProvidersModule {}
