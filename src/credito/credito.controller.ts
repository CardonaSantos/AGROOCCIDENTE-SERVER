import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { CreditoService } from './credito.service';
import { CreateCreditoDto } from './dto/create-credito.dto';
import { UpdateCreditoDto } from './dto/update-credito.dto';

@Controller('credito')
export class CreditoController {
  constructor(private readonly creditoService: CreditoService) {}

  @Post()
  create(@Body() createCreditoDto: CreateCreditoDto) {
    return this.creditoService.create(createCreditoDto);
  }

  @Get()
  findAll() {
    return this.creditoService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.creditoService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCreditoDto: UpdateCreditoDto) {
    return this.creditoService.update(+id, updateCreditoDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.creditoService.remove(+id);
  }
}
