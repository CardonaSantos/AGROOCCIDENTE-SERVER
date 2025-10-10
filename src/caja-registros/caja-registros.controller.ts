import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { CajaRegistrosService } from './caja-registros.service';
import { CreateCajaRegistroDto } from './dto/create-caja-registro.dto';
import { UpdateCajaRegistroDto } from './dto/update-caja-registro.dto';
import { PageOptionsDto } from './dto/page-options';
import { CajaRegistrosQueryDto } from './dto/dto-caja-request';

@Controller('caja-registros')
export class CajaRegistrosController {
  constructor(private readonly cajaRegistrosService: CajaRegistrosService) {}

  // /**
  //  *
  //  * @param pageOptionsDTO limit, page para paginacion (sin sucusalID)
  //  * @returns registros de cajas de todas las sucursales
  //  */
  // @Get('')
  // findAllCajas(@Query() pageOptionsDTO: CajaRegistrosQueryDto) {
  //   return this.cajaRegistrosService.getRegistrosCajas(pageOptionsDTO);
  // }

  /** @returns la caja con todos sus detalles */
  @Get('caja/:id')
  getCaja(@Param('id', ParseIntPipe) id: number) {
    return this.cajaRegistrosService.getRegistroCajaById(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    // return this.cajaRegistrosService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateCajaRegistroDto: UpdateCajaRegistroDto,
  ) {
    // return this.cajaRegistrosService.update(+id, updateCajaRegistroDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    // return this.cajaRegistrosService.remove(+id);
  }
}
