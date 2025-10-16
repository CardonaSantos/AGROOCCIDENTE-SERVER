import { PartialType } from '@nestjs/mapped-types';
import { CreateComprasPagoConRecepcionDto } from './create-compras-pago.dto';

export class UpdateComprasPagoDto extends PartialType(
  CreateComprasPagoConRecepcionDto,
) {}
