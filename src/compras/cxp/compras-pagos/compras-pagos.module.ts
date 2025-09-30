import { Module } from '@nestjs/common';
import { ComprasPagosService } from './compras-pagos.service';
import { ComprasPagosController } from './compras-pagos.controller';

@Module({
  controllers: [ComprasPagosController],
  providers: [ComprasPagosService],
})
export class ComprasPagosModule {}
