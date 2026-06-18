import { Body, Controller, Delete, Get, HttpCode, Post, Put } from '@nestjs/common';
import {
  paperlessConnectionInputSchema,
  type ConnectionStatus,
  type ConnectionTestResult,
  type PaperlessConnectionInput,
} from '@paperless-ai/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ConnectionService } from './connection.service';

const inputPipe = new ZodValidationPipe(paperlessConnectionInputSchema);

@Controller('connection')
export class ConnectionController {
  constructor(private readonly connection: ConnectionService) {}

  @Get()
  status(): ConnectionStatus {
    return this.connection.getStatus();
  }

  /** Probe a candidate connection without saving it. */
  @Post('test')
  @HttpCode(200)
  test(
    @Body(inputPipe) input: PaperlessConnectionInput,
  ): Promise<ConnectionTestResult> {
    return this.connection.test(input);
  }

  /** Validate and persist the connection (token encrypted at rest). */
  @Put()
  save(@Body(inputPipe) input: PaperlessConnectionInput): Promise<ConnectionStatus> {
    return this.connection.save(input);
  }

  @Delete()
  @HttpCode(204)
  remove(): void {
    this.connection.remove();
  }
}
