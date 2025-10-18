import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { CreditosVentaSolicitudesService } from './creditos-venta-solicitudes.service';
import { CreateCreditosVentaSolicitudeDto } from './dto/create-creditos-venta-solicitude.dto';
import { UpdateCreditosVentaSolicitudeDto } from './dto/update-creditos-venta-solicitude.dto';

@Controller('creditos-venta-solicitudes')
export class CreditosVentaSolicitudesController {
  constructor(
    private readonly creditosVentaSolicitudesService: CreditosVentaSolicitudesService,
  ) {}

  @Post()
  create(
    @Body() createCreditosVentaSolicitudeDto: CreateCreditosVentaSolicitudeDto,
  ) {
    return this.creditosVentaSolicitudesService.create(
      createCreditosVentaSolicitudeDto,
    );
  }
}
