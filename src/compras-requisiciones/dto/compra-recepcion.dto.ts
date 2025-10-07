// dto/compra-recepcion-auto.dto.ts
import { MetodoPago } from '@prisma/client';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class RecepcionarCompraAutoDto {
  @IsInt()
  compraId!: number;

  @IsInt()
  usuarioId!: number;

  @IsInt()
  proveedorId: number;

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsEnum(MetodoPago)
  metodoPago: MetodoPago;

  @IsNumber()
  @IsOptional()
  registroCajaId?: number;

  @IsInt()
  sucursalId: number;

  @IsInt()
  cuentaBancariaId: number;

  lineas?: lineasOverrride[];
}

class lineasOverrride {
  fechaVencimiento: string;
  compraDetalleId: number;
  loteCodigo: string;
}
