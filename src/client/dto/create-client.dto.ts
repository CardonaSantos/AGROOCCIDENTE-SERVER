import { Transform } from 'class-transformer';
import { IsOptional, Matches, IsString } from 'class-validator';
import { normalizeDpi, normalizeNit } from '../helpers/helpersClient';

export class CreateClientDto {
  @IsString() nombre: string;
  @IsOptional() @IsString() apellidos?: string;
  @IsOptional() @IsString() telefono?: string;
  @IsOptional() @IsString() direccion?: string;
  @IsOptional() @IsString() observaciones?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeDpi(value))
  @Matches(/^\d{13}$/, { message: 'DPI debe tener 13 dígitos numéricos' })
  dpi?: string | null;

  @IsOptional()
  @Transform(({ value }) => normalizeNit(value))
  @Matches(/^[0-9]{7,12}[0-9K]$/, { message: 'NIT inválido' })
  nit?: string | null;
}

export class UpdateClientDto extends CreateClientDto {}
