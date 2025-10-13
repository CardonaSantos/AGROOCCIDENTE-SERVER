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
import { DocumentoService } from './documento.service';
import { CreateDocumentoDto } from './dto/create-documento.dto';
import { UpdateDocumentoDto } from './dto/update-documento.dto';

@Controller('credito-documento-compra')
export class DocumentoController {
  constructor(private readonly documentoService: DocumentoService) {}

  @Post('create-registro')
  create(@Body() createDocumentoDto: CreateDocumentoDto) {
    return this.documentoService.createCreditoRegist(createDocumentoDto);
  }

  @Get(':id')
  getCreditoCompra(@Param('id', ParseIntPipe) id: number) {
    return this.documentoService.getCreditoFromCompra(id);
  }

  @Get()
  get() {
    return this.documentoService.getRegists();
  }

  @Delete('delete-all')
  deleteAll() {
    return this.documentoService.deleteAll();
  }
}
