import { Module } from '@nestjs/common';
import { MovimientoFinancieroService } from './movimiento-financiero.service';
import { MovimientoFinancieroController } from './movimiento-financiero.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { UtilitiesService } from 'src/utilities/utilities.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { UtilitiesModule } from 'src/utilities/utilities.module';

@Module({
  imports: [
    PrismaModule,
    UtilitiesModule, // o elimina esto si no existe un módulo y el service es local
  ],
  controllers: [MovimientoFinancieroController],
  providers: [MovimientoFinancieroService],
  exports: [MovimientoFinancieroService], // <-- ¡esto es lo importante!
})
export class MovimientoFinancieroModule {}
