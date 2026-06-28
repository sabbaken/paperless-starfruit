import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { VersionController } from './version.controller';
import { VersionService } from './version.service';

/** Surfaces the running build's version and whether a newer release exists. */
@Module({
  imports: [SettingsModule],
  controllers: [VersionController],
  providers: [VersionService],
})
export class VersionModule {}
