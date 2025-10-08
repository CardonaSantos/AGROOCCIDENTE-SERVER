import { PartialType } from '@nestjs/mapped-types';
import { CreateImagenesPresentacioneDto } from './create-imagenes-presentacione.dto';

export class UpdateImagenesPresentacioneDto extends PartialType(CreateImagenesPresentacioneDto) {}
