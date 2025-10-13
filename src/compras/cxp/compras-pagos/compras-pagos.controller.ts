import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { ComprasPagosService } from './compras-pagos.service';
import { CreateComprasPagoDto } from './dto/create-compras-pago.dto';
import { UpdateComprasPagoDto } from './dto/update-compras-pago.dto';

@Controller('compras-pagos-creditos')
export class ComprasPagosController {
  constructor(private readonly comprasPagosService: ComprasPagosService) {}

  @Post()
  create(@Body() createComprasPagoDto: CreateComprasPagoDto) {
    return this.comprasPagosService.create(createComprasPagoDto);
  }
}
