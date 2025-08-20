import { Module } from '@nestjs/common';
import { PurchaseRequisitionsService } from './purchase-requisitions.service';
import { PurchaseRequisitionsController } from './purchase-requisitions.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { UtilitiesService } from 'src/utilities/utilities.service';
import { HistorialStockTrackerService } from 'src/historial-stock-tracker/historial-stock-tracker.service';

@Module({
  controllers: [PurchaseRequisitionsController],
  providers: [
    PurchaseRequisitionsService,
    PrismaService,

    UtilitiesService,
    HistorialStockTrackerService,
  ],
})
export class PurchaseRequisitionsModule {}
