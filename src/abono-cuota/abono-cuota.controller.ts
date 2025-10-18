import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { AbonoCuotaService } from './abono-cuota.service';
import { CreateAbonoCuotaDto } from './dto/create-abono-cuota.dto';
import { UpdateAbonoCuotaDto } from './dto/update-abono-cuota.dto';

@Controller('abono-cuota')
export class AbonoCuotaController {
  constructor(private readonly abonoCuotaService: AbonoCuotaService) {}

  @Post()
  create(@Body() createAbonoCuotaDto: CreateAbonoCuotaDto) {
    return this.abonoCuotaService.create(createAbonoCuotaDto);
  }

  @Get()
  findAll() {
    return this.abonoCuotaService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.abonoCuotaService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAbonoCuotaDto: UpdateAbonoCuotaDto) {
    return this.abonoCuotaService.update(+id, updateAbonoCuotaDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.abonoCuotaService.remove(+id);
  }
}
