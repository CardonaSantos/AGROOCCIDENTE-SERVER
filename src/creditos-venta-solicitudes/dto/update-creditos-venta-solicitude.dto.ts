import { PartialType } from '@nestjs/mapped-types';
import { CreateCreditosVentaSolicitudeDto } from './create-creditos-venta-solicitude.dto';

export class UpdateCreditosVentaSolicitudeDto extends PartialType(CreateCreditosVentaSolicitudeDto) {}
