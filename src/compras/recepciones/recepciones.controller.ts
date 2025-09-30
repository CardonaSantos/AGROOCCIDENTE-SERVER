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
import { RecepcionesService } from './recepciones.service';
import { CreateRecepcioneDto } from './dto/create-recepcione.dto';
import { UpdateRecepcioneDto } from './dto/update-recepcione.dto';

@Controller('recepciones')
export class RecepcionesController {
  constructor(private readonly recepcionesService: RecepcionesService) {}

  @Post()
  create(@Body() createRecepcioneDto: CreateRecepcioneDto) {
    return this.recepcionesService.create(createRecepcioneDto);
  }

  @Get('get-recepciones-parciales')
  async getRecepcionesCompraParcial(
    @Query('compraId', ParseIntPipe) compraId: number,
  ) {
    return this.recepcionesService.getRecepcionesCompraParcial(compraId);
  }

  @Get('test')
  recepcionesTest() {
    return this.recepcionesService.getTest();
  }
}
