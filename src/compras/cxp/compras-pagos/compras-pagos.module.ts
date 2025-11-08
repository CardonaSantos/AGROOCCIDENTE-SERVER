import { Module } from '@nestjs/common';
import { ComprasPagosService } from './compras-pagos.service';
import { ComprasPagosController } from './compras-pagos.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { MovimientoFinancieroService } from 'src/movimiento-financiero/movimiento-financiero.service';
import { ProrrateoService } from 'src/prorrateo/prorrateo.service';
import { ProrrateoModule } from 'src/prorrateo/prorrateo.module';

@Module({
  imports: [ProrrateoModule],
  controllers: [ComprasPagosController],
  providers: [ComprasPagosService, PrismaService, MovimientoFinancieroService],
})
export class ComprasPagosModule {}
