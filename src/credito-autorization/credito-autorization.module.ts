// credito-autorization.module.ts
import { Module } from '@nestjs/common';
import { CreditoAutorizationService } from './credito-autorization.service';
import { CreditoAutorizationController } from './credito-autorization.controller';
import { GatewayModule } from 'src/web-sockets/websocket.module';
import { VentaModule } from 'src/venta/venta.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { MovimientoFinancieroModule } from 'src/movimiento-financiero/movimiento-financiero.module';
import { NotificationModule } from 'src/notification/notification.module';

@Module({
  imports: [
    PrismaModule,
    GatewayModule,
    VentaModule,
    MovimientoFinancieroModule,
    NotificationModule,
  ],
  controllers: [CreditoAutorizationController],
  providers: [CreditoAutorizationService],
})
export class CreditoAutorizationModule {}
