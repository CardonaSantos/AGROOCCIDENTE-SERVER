import { Module } from '@nestjs/common';
import { RecepcionesService } from './recepciones.service';
import { RecepcionesController } from './recepciones.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [RecepcionesController],
  providers: [RecepcionesService, PrismaService],
})
export class RecepcionesModule {}
