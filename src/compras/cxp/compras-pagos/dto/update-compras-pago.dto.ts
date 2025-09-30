import { PartialType } from '@nestjs/mapped-types';
import { CreateComprasPagoDto } from './create-compras-pago.dto';

export class UpdateComprasPagoDto extends PartialType(CreateComprasPagoDto) {}
