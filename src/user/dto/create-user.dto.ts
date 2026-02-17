import { Rol } from '@prisma/client';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateUserDto {
  @IsNumber()
  id?: number;

  @IsString()
  nombre: string;

  @IsEmail()
  @IsString()
  correo: string;

  @IsString()
  @IsOptional()
  telefono?: string;

  @IsEnum(Rol)
  rol: Rol;

  @Min(8)
  @IsString()
  contrasena: string;

  @Min(8)
  @IsString()
  contrasenaConfirm?: string;

  @IsInt()
  sucursalId: number;

  @IsBoolean()
  activo: boolean;
}
