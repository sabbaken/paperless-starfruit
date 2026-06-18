import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import {
  providerInputSchema,
  providerTestInputSchema,
  providerUpdateSchema,
  type ProviderConfig,
  type ProviderInput,
  type ProviderTestInput,
  type ProviderTestResult,
  type ProviderUpdate,
} from '@paperless-ai/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ProviderService } from './provider.service';

const createPipe = new ZodValidationPipe(providerInputSchema);
const updatePipe = new ZodValidationPipe(providerUpdateSchema);
const testPipe = new ZodValidationPipe(providerTestInputSchema);

@Controller('providers')
export class ProviderController {
  constructor(private readonly providers: ProviderService) {}

  @Get()
  list(): ProviderConfig[] {
    return this.providers.list();
  }

  /** Probe a connection (declared before `:id` so "test" isn't read as an id). */
  @Post('test')
  @HttpCode(200)
  test(@Body(testPipe) input: ProviderTestInput): Promise<ProviderTestResult> {
    return this.providers.test(input);
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number): ProviderConfig {
    return this.providers.get(id);
  }

  @Post()
  create(@Body(createPipe) input: ProviderInput): ProviderConfig {
    return this.providers.create(input);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body(updatePipe) input: ProviderUpdate,
  ): ProviderConfig {
    return this.providers.update(id, input);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseIntPipe) id: number): void {
    this.providers.remove(id);
  }
}
