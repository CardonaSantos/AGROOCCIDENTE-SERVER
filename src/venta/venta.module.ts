import { Module } from '@nestjs/common';
import { VentaService } from './venta.service';
import { VentaController } from './venta.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { ClientRemoveService } from 'src/client-remove/client-remove.service';
import { ClientService } from 'src/client/client.service';
import { NotificationService } from 'src/notification/notification.service';
import { LegacyGateway } from 'src/web-sockets/websocket.gateway';
import { HistorialStockTrackerService } from 'src/historial-stock-tracker/historial-stock-tracker.service';
import { CajaService } from 'src/caja/caja.service';
import { UtilidadesService } from 'src/caja/utilidades/utilidades.service';
import { CajaModule } from 'src/caja/caja.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { MetasService } from 'src/metas/metas.service';
import { MetasModule } from 'src/metas/metas.module';

@Module({
  imports: [PrismaModule, CajaModule, MetasModule], // importa el módulo que exporta CajaService
  controllers: [VentaController],
  providers: [
    VentaService,
    ClientService,
    NotificationService,
    LegacyGateway,
    HistorialStockTrackerService,
    UtilidadesService, // si aún lo usas directo aquí
  ],
  exports: [VentaService],
})
export class VentaModule {}
