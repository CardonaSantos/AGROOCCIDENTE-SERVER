import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
} from '@nestjs/common';
import { StockService } from './stock.service';
import { CreateStockDto, StockEntryDTO } from './dto/create-stock.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { DeleteStockDto } from './dto/delete-stock.dto';

@Controller('stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Post()
  async create(@Body() createStockDto: StockEntryDTO) {
    console.log('Entrando al stock controller');
    console.log('Los datos en el controller son: ', createStockDto);

    return await this.stockService.create(createStockDto);
  }

  @Get()
  async findAll() {
    return await this.stockService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return await this.stockService.findOne(id);
  }

  @Get('/get-one-stock/:id')
  async findOneStock(@Param('id', ParseIntPipe) id: number) {
    return await this.stockService.findOneStock(id);
  }

  @Post('/delete-stock')
  async deleteOneStock(@Body() dto: DeleteStockDto) {
    return await this.stockService.deleteOneStock(dto);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateStockDto: UpdateStockDto,
  ) {
    return await this.stockService.update(id, updateStockDto);
  }

  @Delete('/delete-all')
  async removeAll() {
    return await this.stockService.removeAll();
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return await this.stockService.remove(id);
  }
}
