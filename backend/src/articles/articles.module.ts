import { Module } from '@nestjs/common';
import { ArticlesController, MeArticlesController } from './articles.controller';
import { ArticlesService } from './articles.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [ArticlesController, MeArticlesController],
  providers: [ArticlesService],
  exports: [ArticlesService],
})
export class ArticlesModule {}