import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  Query,
  Put,
  DefaultValuePipe,
} from '@nestjs/common';
import { RequisicionService } from './requisicion.service';
import { CreateRequisicionDto } from './dto/create-requisicion.dto';
import { UpdateRequisicionDto } from './dto/update-requisicion.dto';
import {
  CreateRequisitionDto,
  RequisitionResponse,
  StockAlertItem,
} from './utils';
import { UpdateRequisitionDto } from './dto/update-requisiciones.dto';
import { RequisicionLineasDTO } from './interfaces/requiscionWithPresentaciones';

@Controller('requisicion')
export class RequisicionController {
  constructor(private readonly requisicionService: RequisicionService) {}

  /** Paso A: obtener productos con bajo stock */
  @Get('preview')
  findAlerts(
    @Query('sucursalId', ParseIntPipe) sucursalId: number,
  ): Promise<StockAlertItem[]> {
    return this.requisicionService.getStockAlerts(sucursalId);
  }

  /** Nuevo endpoint v2 con paginación, búsqueda y orden */
  @Get('candidatos-requisicion')
  async getRequisitionProductsV2(
    @Query('sucursalId', ParseIntPipe) sucursalId: number,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe) pageSize: number,
    @Query('q') q?: string,
    @Query('sortBy')
    sortBy:
      | 'priority'
      | 'nombre'
      | 'codigoProducto'
      | 'stockTotalEq'
      | 'stockMinimo'
      | 'faltanteSugerido' = 'priority',
    @Query('sortDir') sortDir: 'asc' | 'desc' = 'asc',
  ) {
    return this.requisicionService.getRequisitionProductsV2({
      sucursalId,
      page,
      pageSize,
      q: q?.trim() || '',
      sortBy,
      sortDir,
    });
  }

  @Get('requisicion-to-edit/:requisicionId')
  getRequisicionToEdit(
    @Param('requisicionId', ParseIntPipe) requisicionId: number,
  ): Promise<StockAlertItem[]> {
    return this.requisicionService.getRequisicionForEdit(requisicionId);
  }

  /** Paso C: crear requisición con las líneas seleccionadas */
  @Post()
  create(@Body() dto: RequisicionLineasDTO) {
    return this.requisicionService.createWithLines(dto);
  }

  @Get()
  findAll() {
    return this.requisicionService.findAll();
  }

  @Get('/one-requisicion/:id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.requisicionService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateRequisicionDto: UpdateRequisicionDto,
  ) {
    return this.requisicionService.update(+id, updateRequisicionDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.requisicionService.remove(id);
  }

  @Put('update')
  async updateRequisicion(@Body() dto: UpdateRequisitionDto) {
    return this.requisicionService.updateRequisitionWithLines(dto);
  }
}
