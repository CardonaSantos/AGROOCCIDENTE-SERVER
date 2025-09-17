import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Logger,
} from '@nestjs/common';
import { StockPresentacionService } from './stock-presentacion.service';
import { CreateStockPresentacionDto } from './dto/create-stock-presentacion.dto';
import { UpdateStockPresentacionDto } from './dto/update-stock-presentacion.dto';

@Controller('stock-presentacion')
export class StockPresentacionController {
  private readonly logger = new Logger(StockPresentacionController.name);
  constructor(
    private readonly stockPresentacionService: StockPresentacionService,
  ) {}

  @Post()
  create(@Body() createStockPresentacionDto: CreateStockPresentacionDto) {
    return this.stockPresentacionService.create(createStockPresentacionDto);
  }

  @Get()
  findAll() {
    return this.stockPresentacionService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.stockPresentacionService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateStockPresentacionDto: UpdateStockPresentacionDto,
  ) {
    return this.stockPresentacionService.update(
      +id,
      updateStockPresentacionDto,
    );
  }

  @Delete('delete-all')
  removeAll() {
    return this.stockPresentacionService.removeAll();
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.stockPresentacionService.remove(+id);
  }
}
