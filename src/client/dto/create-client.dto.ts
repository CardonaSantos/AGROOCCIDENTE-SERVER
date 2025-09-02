import {
  IsOptional,
  IsString,
  IsInt,
  IsPhoneNumber,
  IsNotEmpty,
} from 'class-validator';

export class CreateClientDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsNotEmpty()
  apellidos: string;

  @IsOptional()
  @IsString()
  dpi?: string; // DPI opcional y único

  @IsOptional()
  @IsPhoneNumber('GT') // Código de país para Guatemala
  telefono?: string;

  @IsOptional()
  @IsString()
  direccion?: string;

  @IsOptional()
  @IsInt()
  municipioId?: number;

  @IsOptional()
  @IsInt()
  departamentoId?: number;

  @IsOptional()
  @IsString()
  observaciones?: string;
}
