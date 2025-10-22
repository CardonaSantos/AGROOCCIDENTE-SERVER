import { MetodoPago } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class CreateAbonoCuotaDTO {
  cuotaId: number;
  montoCapital?: number;
  montoInteres?: number;
  montoMora?: number;
  montoTotal?: number;
}
export class CreateAbonoCreditoDTO {
  ventaCuotaId: number;
  sucursalId: number;
  usuarioId: number;
  metodoPago: MetodoPago;
  referenciaPago?: string;
  montoTotal?: number;
  fechaAbono?: Date;
  detalles: CreateAbonoCuotaDTO[];
  // registroCajaId?: number; // <- si enlazas con caja (schema lo soporta vía registroCajaId en AbonoCredito)
}
