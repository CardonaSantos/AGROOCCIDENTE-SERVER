// dto/get-credito-autorizaciones.dto.ts
import {
  IsInt,
  IsOptional,
  IsString,
  IsIn,
  IsISO8601,
  Min,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { EstadoSolicitud } from '@prisma/client';

export class GetCreditoAutorizacionesDto {
  @IsOptional()
  @IsString()
  //   @IsIn(['PENDIENTE', 'APROBADA', 'RECHAZADA', 'CANCELADA'])
  estado?: EstadoSolicitud;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sucursalId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  clienteId?: number;

  // búsqueda texto: cliente, comentario, producto/presentación
  @IsOptional()
  @IsString()
  q?: string;

  // rango por fechaSolicitud (inclusive)
  @IsOptional()
  @IsISO8601()
  fechaDesde?: string;

  @IsOptional()
  @IsISO8601()
  fechaHasta?: string;

  // paginación
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Transform(({ value }) => value ?? 1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Transform(({ value }) => value ?? 10)
  limit?: number = 10;

  // orden
  @IsOptional()
  @IsString()
  @IsIn([
    'fechaSolicitud',
    'creadoEn',
    'actualizadoEn',
    'totalPropuesto',
    'estado',
  ])
  sortBy?:
    | 'fechaSolicitud'
    | 'creadoEn'
    | 'actualizadoEn'
    | 'totalPropuesto'
    | 'estado' = 'fechaSolicitud';

  @IsOptional()
  @IsString()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc' = 'desc';
}
