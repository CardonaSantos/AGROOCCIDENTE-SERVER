import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class QueryParamsInventariado {
  @Type(() => Number) // asegura casteo
  @IsNumber()
  @IsOptional()
  sucursalId: number = 1;

  @IsOptional()
  @IsString()
  productoNombre?: string;

  @IsOptional()
  @IsString()
  codigoProducto?: string;

  @IsOptional()
  @IsString()
  fechaVencimiento?: string;

  @IsNumber()
  @IsOptional()
  precio?: number; //precio venta

  @IsOptional()
  @IsArray()
  @IsInt({ each: true }) // cada item debe ser un entero
  @Type(() => Number) // transforma query strings a number
  categorias?: number[];

  //   PAGINACION ============>
  @IsInt()
  @Type(() => Number)
  page: number = 1;

  @IsInt()
  @Type(() => Number)
  limit: number = 10;

  q?: string; // <- NUEVO (opcional)
}
