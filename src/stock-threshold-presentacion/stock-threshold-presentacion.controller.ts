import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { StockThresholdPresentacionService } from './stock-threshold-presentacion.service';
import { CreateStockThresholdPresentacionDto } from './dto/create-stock-threshold-presentacion.dto';
import { UpdateStockThresholdPresentacionDto } from './dto/update-stock-threshold-presentacion.dto';

@Controller('stock-threshold-presentacion')
export class StockThresholdPresentacionController {
  constructor(private readonly stockThresholdPresentacionService: StockThresholdPresentacionService) {}

  @Post()
  create(@Body() createStockThresholdPresentacionDto: CreateStockThresholdPresentacionDto) {
    return this.stockThresholdPresentacionService.create(createStockThresholdPresentacionDto);
  }

  @Get()
  findAll() {
    return this.stockThresholdPresentacionService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.stockThresholdPresentacionService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateStockThresholdPresentacionDto: UpdateStockThresholdPresentacionDto) {
    return this.stockThresholdPresentacionService.update(+id, updateStockThresholdPresentacionDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.stockThresholdPresentacionService.remove(+id);
  }
}
