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
} from '@nestjs/common';
import { PurchaseRequisitionsService } from './purchase-requisitions.service';
import { CreatePurchaseRequisitionDto } from './dto/create-purchase-requisition.dto';
import { UpdatePurchaseRequisitionDto } from './dto/update-purchase-requisition.dto';
import { ComprasRegistrosQueryDto } from './dto/compras-registros.query.dto';
import { RecepcionarCompraAutoDto } from './dto/compra-recepcion.dto';
// import { CreateCompraRecepcionDto } from './dto/compra-recepcion.dto';

@Controller('compra-requisicion')
export class PurchaseRequisitionsController {
  constructor(
    private readonly purchaseRequisitionsService: PurchaseRequisitionsService,
  ) {}

  /**
   * Generar la compra a partir de una Requisicion
   * @param createPurchaseRequisitionDto DTO
   * @returns
   */
  @Post('generar-compra')
  generateCompraFromRequisicion(
    @Body() createPurchaseRequisitionDto: CreatePurchaseRequisitionDto,
  ) {
    return this.purchaseRequisitionsService.createCompraFromRequisiciones(
      createPurchaseRequisitionDto,
    );
  }

  @Post(':id/recepcionar')
  recepcionarById(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: Omit<RecepcionarCompraAutoDto, 'compraId'> & { compraId?: number },
  ) {
    return this.purchaseRequisitionsService.makeRecepcionCompraAuto({
      ...body,
      compraId: id,
    });
  }

  @Get('get-registros-compras-con-detalle')
  findAll(@Query() q: ComprasRegistrosQueryDto) {
    return this.purchaseRequisitionsService.getRegistrosCompras(q);
  }

  @Get('get-registro/:id')
  getRegistroCompra(@Param('id', ParseIntPipe) id: number) {
    return this.purchaseRequisitionsService.getRegistroCompra(id);
  }

  @Get('get-all-compras')
  getComprasDetallesFull() {
    return this.purchaseRequisitionsService.getComprasDetallesFull();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.purchaseRequisitionsService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updatePurchaseRequisitionDto: UpdatePurchaseRequisitionDto,
  ) {
    return this.purchaseRequisitionsService.update(
      +id,
      updatePurchaseRequisitionDto,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.purchaseRequisitionsService.remove(+id);
  }
}
