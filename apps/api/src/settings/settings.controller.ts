import { Body, Controller, Get, Patch } from '@nestjs/common';
import { settingsUpdateSchema, type Settings, type SettingsUpdate } from '@paperless-starfruit/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { SettingsService } from './settings.service';

const updatePipe = new ZodValidationPipe(settingsUpdateSchema);

@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  get(): Settings {
    return this.settings.get();
  }

  @Patch()
  update(@Body(updatePipe) patch: SettingsUpdate): Settings {
    return this.settings.update(patch);
  }
}
