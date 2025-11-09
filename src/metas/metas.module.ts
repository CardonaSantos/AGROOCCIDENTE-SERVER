import { Module } from '@nestjs/common';
import { MetasService } from './metas.service';
import { MetasController } from './metas.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [MetasController],
  providers: [MetasService, PrismaService],
  exports: [MetasService],
})
export class MetasModule {}
