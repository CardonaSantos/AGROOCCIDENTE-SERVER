import { PartialType } from '@nestjs/mapped-types';
import { CreatePresentacionProductoDto } from './create-presentacion-producto.dto';

export class UpdatePresentacionProductoDto extends PartialType(CreatePresentacionProductoDto) {}
