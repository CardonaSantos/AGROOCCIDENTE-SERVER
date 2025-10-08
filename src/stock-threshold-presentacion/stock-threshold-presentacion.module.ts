import { Module } from '@nestjs/common';
import { StockThresholdPresentacionService } from './stock-threshold-presentacion.service';
import { StockThresholdPresentacionController } from './stock-threshold-presentacion.controller';

@Module({
  controllers: [StockThresholdPresentacionController],
  providers: [StockThresholdPresentacionService],
})
export class StockThresholdPresentacionModule {}
