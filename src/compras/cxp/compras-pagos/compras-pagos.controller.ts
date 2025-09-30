import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ComprasPagosService } from './compras-pagos.service';
import { CreateComprasPagoDto } from './dto/create-compras-pago.dto';
import { UpdateComprasPagoDto } from './dto/update-compras-pago.dto';

@Controller('compras-pagos')
export class ComprasPagosController {
  constructor(private readonly comprasPagosService: ComprasPagosService) {}

  @Post()
  create(@Body() createComprasPagoDto: CreateComprasPagoDto) {
    return this.comprasPagosService.create(createComprasPagoDto);
  }

  @Get()
  findAll() {
    return this.comprasPagosService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.comprasPagosService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateComprasPagoDto: UpdateComprasPagoDto) {
    return this.comprasPagosService.update(+id, updateComprasPagoDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.comprasPagosService.remove(+id);
  }
}
