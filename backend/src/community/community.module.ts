import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  CommunityController,
  MeCommunityController,
} from './community.controller';
import { CommunityService } from './community.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [ConfigModule, NotificationsModule],
  controllers: [CommunityController, MeCommunityController],
  providers: [CommunityService],
  exports: [CommunityService],
})
export class CommunityModule {}