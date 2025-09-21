import { Module } from '@nestjs/common';
import { CuotasService } from './cuotas.service';
import { CuotasController } from './cuotas.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { CajaModule } from 'src/caja/caja.module';
import { MetasService } from 'src/metas/metas.service';
import { MovimientoFinancieroService } from 'src/movimiento-financiero/movimiento-financiero.service';

@Module({
  imports: [CajaModule],
  controllers: [CuotasController],
  providers: [
    CuotasService,
    PrismaService,
    MetasService,
    MovimientoFinancieroService,
  ],
})
export class CuotasModule {}
