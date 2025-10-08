import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { ImagenesPresentacionesService } from './imagenes-presentaciones.service';
import { CreateImagenesPresentacioneDto } from './dto/create-imagenes-presentacione.dto';
import { UpdateImagenesPresentacioneDto } from './dto/update-imagenes-presentacione.dto';

@Controller('imagenes-presentaciones')
export class ImagenesPresentacionesController {
  constructor(
    private readonly imagenesPresentacionesService: ImagenesPresentacionesService,
  ) {}

  @Post()
  create(
    @Body() createImagenesPresentacioneDto: CreateImagenesPresentacioneDto,
  ) {
    return this.imagenesPresentacionesService.create(
      createImagenesPresentacioneDto,
    );
  }
}
