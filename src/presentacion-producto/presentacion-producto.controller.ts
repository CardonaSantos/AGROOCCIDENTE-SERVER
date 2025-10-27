import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  Query,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { PresentacionProductoService } from './presentacion-producto.service';
import { CreatePresentacionProductoDto } from './dto/create-presentacion-producto.dto';
import { UpdatePresentacionProductoDto } from './dto/update-presentacion-producto.dto';
import { FilesInterceptor } from '@nestjs/platform-express';

@Controller('presentacion-producto')
export class PresentacionProductoController {
  constructor(
    private readonly presentacionProductoService: PresentacionProductoService,
  ) {}
  @Post('/productos/:productoId/presentaciones')
  create(
    @Param('productoId', ParseIntPipe) productoId: number,
    @Body() dto: Omit<CreatePresentacionProductoDto, 'productoId'>,
  ) {
    // return this.presentacionProductoService.create({ ...dto, productoId });
  }

  @Get(':id')
  async getOne(@Param('id', ParseIntPipe) id: number) {
    return this.presentacionProductoService.getPresentationDetail(id); // → PresentationDetailDTO
  }

  @Patch(':id')
  @UseInterceptors(FilesInterceptor('images'))
  async updateOne(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFiles() images: Express.Multer.File[],
    @Body() body: any,
  ) {
    // return this.presentacionProductoService.updatePresentationFromFormData(
    //   id,
    //   body,
    //   images,
    // );
  }

  @Patch('/presentaciones/:id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePresentacionProductoDto,
  ) {
    // return this.presentacionProductoService.update(id, dto);
  }

  @Post('/presentaciones/:id/default')
  setDefault(@Param('id', ParseIntPipe) id: number) {
    return this.presentacionProductoService.setDefault(id);
  }

  @Get('/productos/:productoId/presentaciones')
  findByProducto(@Param('productoId', ParseIntPipe) productoId: number) {
    return this.presentacionProductoService.findByProducto(productoId);
  }

  @Get('/presentaciones/search')
  search(@Query('q') q: string) {
    return this.presentacionProductoService.searchPOS(q ?? '');
  }
}
