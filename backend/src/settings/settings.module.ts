import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { PrivacyController } from './privacy.controller';
import { PrivacyService } from './privacy.service';

@Module({
  imports: [PrismaModule],
  controllers: [SettingsController, PrivacyController],
  providers: [SettingsService, PrivacyService],
  exports: [SettingsService, PrivacyService],
})
export class SettingsModule {}
