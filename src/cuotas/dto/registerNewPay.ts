import {
  IsInt,
  IsOptional,
  IsPositive,
  IsEnum,
  IsDate,
  IsNotEmpty,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EstadoPago, MetodoPago } from '@prisma/client';

// Enum para el estado de la cuota

export class CuotaDto {
  @IsInt()
  @IsNotEmpty()
  ventaCuotaId: number; // Relación con la venta a cuotas

  @IsInt()
  @IsNotEmpty()
  CreditoID: number;

  @IsPositive()
  monto: number; // Monto de la cuota

  @IsDate()
  @Type(() => Date)
  fechaVencimiento: Date; // Fecha en que debe realizarse el pago

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  fechaPago?: Date | null; // Fecha en que se realizó el pago

  @IsEnum(EstadoPago)
  estado: EstadoPago; // Estado de la cuota

  @IsOptional()
  @IsInt()
  usuarioId?: number | null; // Usuario que recibió el pago (opcional)

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  creadoEn?: Date; // Fecha de creación (opcional)

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  actualizadoEn?: Date; // Fecha de última actualización (opcional)

  @IsOptional()
  comentario?: string;

  @IsEnum(MetodoPago)
  metodoPago: MetodoPago;

  @IsOptional()
  @IsNumber()
  cuentaBancariaId?: string;
}
