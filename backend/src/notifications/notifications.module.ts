import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsGateway } from './notifications.gateway';
import { ExpoPushService } from './expo-push.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsGateway, ExpoPushService],
  exports: [NotificationsService, NotificationsGateway, ExpoPushService],
})
export class NotificationsModule {}
