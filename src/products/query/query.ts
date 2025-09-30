import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TipoEmpaque } from '@prisma/client';

export class QueryParamsInventariado {
  @Type(() => Number) // asegura casteo
  @IsNumber()
  sucursalId: number;

  @IsOptional()
  @IsString()
  productoNombre?: string;

  @IsOptional()
  @IsString()
  codigoProducto?: string;

  @IsOptional()
  @IsString()
  fechaVencimiento?: string;

  @IsArray()
  @IsEnum(TipoEmpaque, { each: true })
  tipoPresentacion: TipoEmpaque[];

  @IsNumber()
  precio: number; //precio venta

  @IsOptional()
  @IsArray()
  @IsInt({ each: true }) // cada item debe ser un entero
  @Type(() => Number) // transforma query strings a number
  categorias?: number[];
}
