import { Injectable } from '@nestjs/common';
import { CreateImagenesPresentacioneDto } from './dto/create-imagenes-presentacione.dto';
import { UpdateImagenesPresentacioneDto } from './dto/update-imagenes-presentacione.dto';

@Injectable()
export class ImagenesPresentacionesService {
  create(createImagenesPresentacioneDto: CreateImagenesPresentacioneDto) {
    return 'This action adds a new imagenesPresentacione';
  }
}
