import { Module } from '@nestjs/common';
import { PresentacionProductoService } from './presentacion-producto.service';
import { PresentacionProductoController } from './presentacion-producto.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [PresentacionProductoController],
  providers: [PresentacionProductoService, PrismaService],
})
export class PresentacionProductoModule {}
