import { Module } from '@nestjs/common';
import { DocumentoService } from './documento.service';
import { DocumentoController } from './documento.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { MovimientoFinancieroService } from 'src/movimiento-financiero/movimiento-financiero.service';

@Module({
  controllers: [DocumentoController],
  providers: [DocumentoService, PrismaService, MovimientoFinancieroService],
})
export class DocumentoModule {}
