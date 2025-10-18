import { Module } from '@nestjs/common';
import { CreditosVentaSolicitudesService } from './creditos-venta-solicitudes.service';
import { CreditosVentaSolicitudesController } from './creditos-venta-solicitudes.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [CreditosVentaSolicitudesController],
  providers: [CreditosVentaSolicitudesService, PrismaService],
})
export class CreditosVentaSolicitudesModule {}
