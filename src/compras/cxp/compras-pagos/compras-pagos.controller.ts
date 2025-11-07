import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  ParseIntPipe,
} from '@nestjs/common';
import { ComprasPagosService } from './compras-pagos.service';
import { DeletePagoCuota } from './dto/delete-pago-cuota';
import { CreateComprasPagoConRecepcionDto } from './dto/create-compras-pago.dto';

@Controller('compras-pagos-creditos')
export class ComprasPagosController {
  constructor(private readonly comprasPagosService: ComprasPagosService) {}

  @Post()
  create(@Body() createComprasPagoDto: CreateComprasPagoConRecepcionDto) {
    return this.comprasPagosService.create(createComprasPagoDto);
  }
  @Get('get-detalles-productos-recepcion/:id')
  getProductosLineas(@Param('id', ParseIntPipe) id: number) {
    return this.comprasPagosService.getDetallesConRecepcion(id);
  }

  @Post('delete-cuota-payed')
  deleteCuota(@Body() dto: DeletePagoCuota) {
    return this.comprasPagosService.deletePagoCuota(dto);
  }
}
