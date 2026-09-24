import { Module } from '@nestjs/common';
import {
  MeHiddenController,
  ModerationController,
  RecommendationFeedbackController,
} from './moderation.controller';
import { AdminModerationController } from './admin-moderation.controller';
import { ModerationService } from './moderation.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [
    ModerationController,
    MeHiddenController,
    RecommendationFeedbackController,
    AdminModerationController,
  ],
  providers: [ModerationService],
  exports: [ModerationService],
})
export class ModerationModule {}
