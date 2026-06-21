import { Module } from '@nestjs/common';
import { ProviderController } from './provider.controller';
import { ProviderService } from './provider.service';
import { LlmService } from './llm.service';
import { OcrService } from './ocr.service';

/** LLM/OCR provider configuration + the structured-output and OCR engines. */
@Module({
  controllers: [ProviderController],
  providers: [ProviderService, LlmService, OcrService],
  exports: [ProviderService, LlmService, OcrService],
})
export class ProvidersModule {}
