import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { LegacyGateway } from 'src/web-sockets/websocket.gateway';

@Module({
  controllers: [NotificationController],
  providers: [NotificationService, PrismaService, LegacyGateway],
})
export class NotificationModule {}
