import { Module } from '@nestjs/common';
import { SolicitudTransferenciaProductoService } from './solicitud-transferencia-producto.service';
import { SolicitudTransferenciaProductoController } from './solicitud-transferencia-producto.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { LegacyGateway } from 'src/web-sockets/websocket.gateway';
import { NotificationService } from 'src/notification/notification.service';
import { HistorialStockTrackerService } from 'src/historial-stock-tracker/historial-stock-tracker.service';

@Module({
  controllers: [SolicitudTransferenciaProductoController],
  providers: [
    SolicitudTransferenciaProductoService,
    PrismaService,
    LegacyGateway,
    NotificationService,
    HistorialStockTrackerService,
  ],
})
export class SolicitudTransferenciaProductoModule {}
