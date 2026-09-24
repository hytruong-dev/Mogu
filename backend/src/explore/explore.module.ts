import { Module } from '@nestjs/common';
import { CommunityModule } from '../community/community.module';
import { ExploreController } from './explore.controller';
import { ExploreService } from './explore.service';

@Module({
  imports: [CommunityModule],
  controllers: [ExploreController],
  providers: [ExploreService],
})
export class ExploreModule {}
