import { Module } from '@nestjs/common';
import { VencimientosService } from './vencimientos.service';
import { VencimientosController } from './vencimientos.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationService } from 'src/notification/notification.service';
import { LegacyGateway } from 'src/web-sockets/websocket.gateway';

@Module({
  controllers: [VencimientosController],
  providers: [
    VencimientosService,
    PrismaService,
    NotificationService,
    LegacyGateway,
  ],
})
export class VencimientosModule {}
