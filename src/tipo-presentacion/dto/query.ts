import { Type, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const toBool = (v: any) =>
  typeof v === 'boolean'
    ? v
    : typeof v === 'string'
      ? ['true', '1', 'yes', 'si', 'sí'].includes(v.toLowerCase())
      : undefined;

export class TipoPresentacionQueryDto {
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
  @IsString()
  @MaxLength(60)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  q?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => toBool(value))
  activo?: boolean;
}
