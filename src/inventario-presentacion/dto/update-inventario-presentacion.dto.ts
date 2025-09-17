import { PartialType } from '@nestjs/mapped-types';
import { CreateInventarioPresentacionDto } from './create-inventario-presentacion.dto';

export class UpdateInventarioPresentacionDto extends PartialType(CreateInventarioPresentacionDto) {}
