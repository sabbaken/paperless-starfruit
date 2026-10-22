import { Controller, Get, Query } from '@nestjs/common';
import { statsQuerySchema, type Stats, type StatsQuery } from '@paperless-starfruit/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { StatsService } from './stats.service';

@Controller('stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get()
  get(@Query(new ZodValidationPipe(statsQuerySchema)) query: StatsQuery): Stats {
    return this.stats.get(query.period);
  }
}
