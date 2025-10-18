import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { CuotasService } from './cuotas.service';
import { CreateCuotaDto } from './dto/create-cuota.dto';
import { UpdateVentaCuotaDto } from './dto/update-cuota.dto';
import { CreateVentaCuotaDto } from './dto/create-ventacuota.dto';
import { CreatePlantillaComprobanteDto } from './dto/plantilla-comprobante.dt';
import { CuotaDto } from './dto/registerNewPay';
import { CloseCreditDTO } from './dto/close-credit.dto';
import { DeleteOneRegistCreditDto } from './dto/delete-one-regist.dto';
import { DeleteCuotaPaymentDTO } from './dto/delete-one-payment-cuota.dto';

@Controller('cuotas')
export class CuotasController {
  constructor(private readonly cuotasService: CuotasService) {}

  /**
   * Generador de registro principal de credito
   * @param createCuotaDto DTO para generar un credito de venta (envia cuotas listas desde la UI)
   * @returns
   */
  @Post()
  // @UsePipes(new ValidationPipe({ transform: true }))
  create(@Body() createCuotaDto: CreateVentaCuotaDto) {
    return this.cuotasService.create(createCuotaDto);
  }

  //CREAR PLANTILLA
  @Post('/plantilla-create')
  createPlantilla(@Body() createPlantilla: CreatePlantillaComprobanteDto) {
    return this.cuotasService.createPlantilla(createPlantilla);
  }

  //CREAR PLANTILLA
  @Post('/register-new-pay')
  registerNewPay(@Body() createCuotaDto: CuotaDto) {
    return this.cuotasService.registerNewPay(createCuotaDto);
  }

  @Get('/get-credits-without-paying')
  getCredutsWithoutPaying() {
    return this.cuotasService.getCredutsWithoutPaying();
  }

  //TODAS LAS PLANTILLAS
  @Get('/get/plantillas')
  getPlantillas() {
    return this.cuotasService.getPlantillas();
  }

  //TODAS LAS VentaCuotas
  @Get('/get/credits')
  getAllCredits() {
    return this.cuotasService.getAllCredits();
  }

  //UNA PLANTILLA
  @Get('/get/plantilla/:id')
  getPlantilla(@Param('id', ParseIntPipe) id: number) {
    return this.cuotasService.getPlantilla(id);
  }

  //UNA PLANTILLA-TO EDIT
  @Get('/get/plantilla-to-edit/:id')
  getPlantillaToEdit(@Param('id', ParseIntPipe) id: number) {
    return this.cuotasService.getPlantillaToEdit(id);
  }

  //UNA CUOTA
  @Get('/get/comprobante/cuota/:id')
  getComprobanteCuota(@Param('id', ParseIntPipe) id: number) {
    return this.cuotasService.getComprobanteCuota(id);
  }

  //UNA CUOTA
  @Get('/get/cuota/:id')
  getCuota(@Param('id', ParseIntPipe) id: number) {
    return this.cuotasService.getCuota(id);
  }

  @Delete('/delete-all')
  deletAllCreditRegist() {
    return this.cuotasService.deleteAll();
  }

  @Delete('/delete-one-placeholder/:id')
  deleteOnePlaceholder(@Param('id', ParseIntPipe) id: number) {
    return this.cuotasService.deleteOnePlaceholder(id);
  }

  @Delete('/delete-all-plantillas')
  deleteAllPlantillas() {
    return this.cuotasService.deleteAllPlantillas();
  }

  @Patch('/close-credit-regist/:id')
  closeCreditRegist(
    @Body() closeCreditDto: CloseCreditDTO,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.cuotasService.closeCreditRegist(id, closeCreditDto);
  }

  @Patch('/update-plantilla/:id')
  updatePlantilla(
    @Body() createPlantillaComprobanteDto: CreatePlantillaComprobanteDto,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.cuotasService.updatePlantilla(
      id,
      createPlantillaComprobanteDto,
    );
  }

  @Delete('/delete-all-creditos-prueba')
  deleteAllCreditosPrueba() {
    return this.cuotasService.deleteAllCreditosPrueba();
  }

  @Delete('/delete-one-credit-regist')
  deleteOneCreditRegist(@Body() deleteOneCreditDto: DeleteOneRegistCreditDto) {
    return this.cuotasService.deleteOneCreditRegist(deleteOneCreditDto);
  }

  @Delete('/delete-one-payment-cuota')
  deleteOnePaymentCuota(@Body() deleteOnePayment: DeleteCuotaPaymentDTO) {
    return this.cuotasService.deleteOnePaymentCuota(deleteOnePayment);
  }
}
