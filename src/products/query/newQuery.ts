import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsNumber,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

const emptyToUndefined = ({ value }: { value: any }) =>
  value === '' || value === null ? undefined : value;

export class newQueryDTO {
  @IsString()
  @IsOptional()
  @Transform(emptyToUndefined)
  nombreItem?: string;

  @IsString()
  @IsOptional()
  @Transform(emptyToUndefined)
  codigoItem?: string;

  @IsString()
  @IsOptional()
  @Transform(emptyToUndefined)
  codigoProveedor?: string;

  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === '' || value == null) return undefined;
    if (Array.isArray(value)) return value.map((v) => Number(v));
    return [Number(value)];
  })
  cats?: number[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Transform(({ value }) => (value === '' ? undefined : Number(value)))
  priceRange?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Transform(({ value }) => (value === '' ? undefined : Number(value)))
  sucursalId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Transform(({ value }) => (value === '' ? undefined : Number(value)))
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Transform(({ value }) => (value === '' ? undefined : Number(value)))
  page?: number;
  //nuevos
  @Type(() => Number)
  @IsArray()
  @IsInt({ each: true })
  @Transform(({ value }) => {
    if (value === '' || value == null) return undefined;
    if (Array.isArray(value)) return value.map((v) => Number(v));
    return [Number(value)];
  })
  @IsOptional()
  tipoEmpaque?: number[];

  q?: string;
}
