import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UsePipes,
  ValidationPipe,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { TipoPresentacionService } from './tipo-presentacion.service';
import { CreateTipoPresentacionDto } from './dto/create-tipo-presentacion.dto';
import { UpdateTipoPresentacionDto } from './dto/update-tipo-presentacion.dto';
import { TipoPresentacionQueryDto } from './dto/query';

@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@Controller('tipo-presentacion')
export class TipoPresentacionController {
  constructor(private readonly service: TipoPresentacionService) {}

  @Post()
  create(@Body() dto: CreateTipoPresentacionDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(@Query() query: TipoPresentacionQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTipoPresentacionDto,
  ) {
    return this.service.update(id, dto);
  }

  // Soft delete (desactivar)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.softRemove(id);
  }

  // Restaurar (reactivar)
  @Patch(':id/restore')
  restore(@Param('id', ParseIntPipe) id: number) {
    return this.service.restore(id);
  }

  // Hard delete definitivo (cuidado con FKs)
  @Delete(':id/hard')
  hardDelete(@Param('id', ParseIntPipe) id: number) {
    return this.service.hardDelete(id);
  }
}
