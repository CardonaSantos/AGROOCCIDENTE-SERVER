import { Module } from '@nestjs/common';
import { ImagenesPresentacionesService } from './imagenes-presentaciones.service';
import { ImagenesPresentacionesController } from './imagenes-presentaciones.controller';

@Module({
  controllers: [ImagenesPresentacionesController],
  providers: [ImagenesPresentacionesService],
})
export class ImagenesPresentacionesModule {}
