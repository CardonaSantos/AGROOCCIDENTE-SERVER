import { Module } from '@nestjs/common';
import { InventarioPresentacionService } from './inventario-presentacion.service';
import { InventarioPresentacionController } from './inventario-presentacion.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [InventarioPresentacionController],
  providers: [InventarioPresentacionService, PrismaService],
})
export class InventarioPresentacionModule {}
