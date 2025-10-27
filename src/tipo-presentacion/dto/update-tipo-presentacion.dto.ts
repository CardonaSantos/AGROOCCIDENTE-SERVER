import { PartialType } from '@nestjs/mapped-types';
import { CreateTipoPresentacionDto } from './create-tipo-presentacion.dto';

export class UpdateTipoPresentacionDto extends PartialType(
  CreateTipoPresentacionDto,
) {}
