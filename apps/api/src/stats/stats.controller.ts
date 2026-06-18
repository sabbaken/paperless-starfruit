import { Controller, Get } from '@nestjs/common';
import type { Stats } from '@paperless-ai/shared';
import { StatsService } from './stats.service';

@Controller('stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get()
  get(): Stats {
    return this.stats.get();
  }
}
