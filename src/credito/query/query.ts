// dto/credito-query.dto.ts
import { Type, Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  IsBoolean,
  IsDate,
} from 'class-validator';
import {
  EstadoCuota,
  FrecuenciaPago,
  InteresTipo,
  PlanCuotaModo,
} from '@prisma/client';

const toBool = (v: any) =>
  typeof v === 'boolean'
    ? v
    : typeof v === 'string'
      ? ['true', '1', 'yes', 'si', 'sí'].includes(v.toLowerCase())
      : false;

export class CreditoQuery {
  // Paginación
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  // Orden
  @IsOptional()
  @IsString()
  sortBy?:
    | 'fechaInicio'
    | 'fechaProximoPago'
    | 'creadoEn'
    | 'totalVenta'
    | 'totalPagado'
    | 'numeroCredito'
    | 'estado' = 'fechaInicio';

  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';

  // Búsqueda global
  @IsOptional()
  @IsString()
  q?: string;

  // Filtros directos
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sucursalId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  clienteId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  usuarioId?: number;

  @IsOptional()
  @IsEnum(EstadoCuota)
  estado?: EstadoCuota;

  @IsOptional()
  @IsEnum(FrecuenciaPago)
  frecuenciaPago?: FrecuenciaPago;

  @IsOptional()
  @IsEnum(InteresTipo)
  interesTipo?: InteresTipo;

  @IsOptional()
  @IsEnum(PlanCuotaModo)
  planCuotaModo?: PlanCuotaModo;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  fechaInicioFrom?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  fechaInicioTo?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  proximoPagoFrom?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  proximoPagoTo?: Date;

  @IsOptional()
  @Transform(({ value }) => toBool(value))
  @IsBoolean()
  enMora?: boolean;

  @IsOptional()
  @Transform(({ value }) => toBool(value))
  @IsBoolean()
  vencidas?: boolean;

  @IsOptional()
  @IsString()
  numeroCredito?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  ventaId?: number;
}
