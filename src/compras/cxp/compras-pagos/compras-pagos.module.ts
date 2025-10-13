import { Module } from '@nestjs/common';
import { ComprasPagosService } from './compras-pagos.service';
import { ComprasPagosController } from './compras-pagos.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { MovimientoFinancieroService } from 'src/movimiento-financiero/movimiento-financiero.service';

@Module({
  controllers: [ComprasPagosController],
  providers: [ComprasPagosService, PrismaService, MovimientoFinancieroService],
})
export class ComprasPagosModule {}
