import { IsInt, IsOptional, IsEnum, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { EstadoProrrateo, MetodoProrrateo } from '@prisma/client';

export class ListProrrateoDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit: number = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sucursalId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  compraId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  entregaStockId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  requisicionRecepcionId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  movimientoFinancieroId?: number;

  @IsOptional()
  @IsEnum(EstadoProrrateo)
  estado?: EstadoProrrateo;

  @IsOptional()
  @IsEnum(MetodoProrrateo)
  metodo?: MetodoProrrateo;

  /** incluir detalles + stock (por defecto false) */
  @IsOptional()
  includeDetalles?: string;
}
