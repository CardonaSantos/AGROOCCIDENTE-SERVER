import { Module } from '@nestjs/common';
import { MovimientoCajaService } from './movimiento-caja.service';
import { MovimientoCajaController } from './movimiento-caja.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { UtilidadesService } from 'src/caja/utilidades/utilidades.service';
import { CajaService } from 'src/caja/caja.service';

@Module({
  controllers: [MovimientoCajaController],
  providers: [
    MovimientoCajaService,
    PrismaService,
    UtilidadesService,
    CajaService,
  ],
})
export class MovimientoCajaModule {}
