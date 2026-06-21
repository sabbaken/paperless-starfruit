import { Body, Controller, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import {
  promptKeySchema,
  promptTestInputSchema,
  promptUpdateSchema,
  type PromptConfig,
  type PromptKey,
  type PromptTestInput,
  type PromptTestResult,
  type PromptUpdate,
  type TestDocument,
} from '@paperless-starfruit/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PromptsService } from './prompts.service';
import { PromptTestService } from './prompt-test.service';

const keyPipe = new ZodValidationPipe(promptKeySchema);
const updatePipe = new ZodValidationPipe(promptUpdateSchema);
const testPipe = new ZodValidationPipe(promptTestInputSchema);

@Controller('prompts')
export class PromptsController {
  constructor(
    private readonly prompts: PromptsService,
    private readonly tester: PromptTestService,
  ) {}

  @Get()
  list(): PromptConfig[] {
    return this.prompts.list();
  }

  /** Recent documents for the test picker (before `:key` so it isn't read as a key). */
  @Get('documents')
  documents(): Promise<TestDocument[]> {
    return this.tester.recentDocuments();
  }

  @Put(':key')
  update(
    @Param('key', keyPipe) key: PromptKey,
    @Body(updatePipe) input: PromptUpdate,
  ): PromptConfig {
    return this.prompts.update(key, input.body);
  }

  @Post(':key/reset')
  @HttpCode(200)
  reset(@Param('key', keyPipe) key: PromptKey): PromptConfig {
    return this.prompts.reset(key);
  }

  @Post(':key/test')
  @HttpCode(200)
  test(
    @Param('key', keyPipe) key: PromptKey,
    @Body(testPipe) input: PromptTestInput,
  ): Promise<PromptTestResult> {
    return this.tester.test(key, input);
  }
}
