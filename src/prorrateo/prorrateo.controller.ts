import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { ProrrateoService } from './prorrateo.service';
import { CreateProrrateoDto } from './dto/create-prorrateo.dto';
import { UpdateProrrateoDto } from './dto/update-prorrateo.dto';
import { ListProrrateoDto } from './dto/list-prorrateo.dto';

@Controller('prorrateo')
export class ProrrateoController {
  constructor(private readonly prorrateoService: ProrrateoService) {}

  /** Nota: crear prorrateos via API no se recomienda (los crea el utilitario). */
  @Post()
  create(@Body() createProrrateoDto: CreateProrrateoDto) {
    throw new BadRequestException(
      'Los prorrateos se generan automáticamente durante la recepción.',
    );
  }

  /** Listado con filtros/paginación */
  @Get()
  findAll(@Query() q: ListProrrateoDto) {
    return this.prorrateoService.findAll(q);
  }

  /** Listado con filtros/paginación */
  @Get('get-raw-prorrateos')
  findAllRawRegist() {
    return this.prorrateoService.findAllRawRegist();
  }

  /**
   * Stocks con existencias (>0) y resumen de prorrateo:
   * - suma de `montoAsignado`
   * - última fecha (creadoEn) de prorrateo aplicado
   */
  @Get('stocks-con-prorrateo')
  stocksConProrrateo(
    @Query('sucursalId', ParseIntPipe) sucursalId: number,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('productoId') productoId?: string,
  ) {
    return this.prorrateoService.stocksConProrrateo({
      sucursalId,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      productoId: productoId ? Number(productoId) : undefined,
    });
  }

  /** Detalle (incluye detalles + stock por cada detalle) */
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.prorrateoService.findOne(id);
  }

  /** Todos los prorrateos que impactaron un stock específico */
  @Get('by-stock/:stockId')
  findByStock(@Param('stockId', ParseIntPipe) stockId: number) {
    return this.prorrateoService.findByStock(stockId);
  }

  /** Actualizar comentario/estado (anulación) */
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProrrateoDto,
  ) {
    return this.prorrateoService.update(id, dto);
  }
  /** Evitamos borrar físico: redirige a anular */
  @Delete('delete-all')
  deleteAll() {
    return this.prorrateoService.removeAll();
  }
  /** Evitamos borrar físico: redirige a anular */
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.prorrateoService.remove(id);
  }
}
