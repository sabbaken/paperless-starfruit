import { Controller, Get } from '@nestjs/common';
import type { VersionInfo } from '@paperless-starfruit/shared';
import { VersionService } from './version.service';

@Controller('version')
export class VersionController {
  constructor(private readonly version: VersionService) {}

  @Get()
  get(): Promise<VersionInfo> {
    return this.version.getInfo();
  }
}
