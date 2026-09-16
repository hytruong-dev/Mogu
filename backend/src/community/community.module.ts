import { Module } from '@nestjs/common';
import {
  CommunityController,
  MeCommunityController,
} from './community.controller';
import { CommunityService } from './community.service';

@Module({
  controllers: [CommunityController, MeCommunityController],
  providers: [CommunityService],
})
export class CommunityModule {}
