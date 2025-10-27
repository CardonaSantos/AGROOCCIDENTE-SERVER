import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

const trim = (v: any) => (typeof v === 'string' ? v.trim() : v);

export class CreateTipoPresentacionDto {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  @Transform(({ value }) => trim(value))
  nombre!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }) => trim(value))
  descripcion?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const v = value.toLowerCase();
      return ['true', '1', 'yes', 'si', 'sí'].includes(v);
    }
    return undefined;
  })
  activo?: boolean = true;
}
