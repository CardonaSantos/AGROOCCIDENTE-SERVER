import { Module } from '@nestjs/common';
import { PriceRequestService } from './price-request.service';
import { PriceRequestController } from './price-request.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationService } from 'src/notification/notification.service';
import { LegacyGateway } from 'src/web-sockets/websocket.gateway';

@Module({
  controllers: [PriceRequestController],
  providers: [
    PriceRequestService,
    PrismaService,
    NotificationService,
    LegacyGateway, //IMPORTÉ EL GATEWAY PORQUE NOTIFICATION SERCICE DEPENDE DE ÉL
  ],
})
export class PriceRequestModule {}
