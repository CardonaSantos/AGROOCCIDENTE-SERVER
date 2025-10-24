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
import { CategoriaService } from './categoria.service';
import { CreateCategoriaDto } from './dto/create-categoria.dto';
import { UpdateCategoriaDto } from './dto/update-categoria.dto';

@Controller('categoria')
export class CategoriaController {
  constructor(private readonly categoriaService: CategoriaService) {}

  @Post()
  async create(@Body() createCategoriaDto: CreateCategoriaDto) {
    return await this.categoriaService.create(createCategoriaDto);
  }

  @Get()
  async findAll() {
    return await this.categoriaService.findAll();
  }
  //------>
  @Get('all-cats-with-counts')
  getAllCats() {
    return this.categoriaService.findAllWithCounts();
  }

  @Get('get-one-cat/:id')
  getOne(@Param('id', ParseIntPipe) id: number) {
    return this.categoriaService.findOneWithCount(id);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return await this.categoriaService.findOne(id);
  }

  //------>

  @Patch('/edit-category/:id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCategoriaDto: UpdateCategoriaDto,
  ) {
    console.log('Editando categoria');

    return await this.categoriaService.update(id, updateCategoriaDto);
  }

  @Delete('/delete-all')
  async removeAll() {
    return await this.categoriaService.removeAll();
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    console.log('Entrando al controller del delete categoria');

    return await this.categoriaService.remove(id);
  }
}
