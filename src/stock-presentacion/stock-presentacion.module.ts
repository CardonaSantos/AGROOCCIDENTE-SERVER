import { Module } from '@nestjs/common';
import { StockPresentacionService } from './stock-presentacion.service';
import { StockPresentacionController } from './stock-presentacion.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [StockPresentacionController],
  providers: [StockPresentacionService, PrismaService],
})
export class StockPresentacionModule {}
