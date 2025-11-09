import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { VencimientosService } from './vencimientos.service';
import { CreateVencimientoDto } from './dto/create-vencimiento.dto';
import { UpdateVencimientoDto } from './dto/update-vencimiento.dto';

@Controller('vencimientos')
export class VencimientosController {
  constructor(private readonly vencimientosService: VencimientosService) {}

  @Post()
  create(@Body() createVencimientoDto: CreateVencimientoDto) {}

  @Get('/get-all-regist-expiration')
  findAll() {
    return this.vencimientosService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.vencimientosService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateVencimientoDto: UpdateVencimientoDto,
  ) {
    return this.vencimientosService.update(+id, updateVencimientoDto);
  }

  @Delete('/delete-all')
  removeAll() {
    return this.vencimientosService.removeAll();
  }

  @Delete(':id')
  remove(@Param('id') id: string) {}
}
