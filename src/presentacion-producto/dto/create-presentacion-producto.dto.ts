import { RolPrecio } from '@prisma/client';
import {
  IsInt,
  IsOptional,
  IsString,
  IsBoolean,
  IsNumberString,
  Length,
  MaxLength,
} from 'class-validator';

export class CreatePresentacionProductoDto {
  presentacion: PresentacionCreate[];
}

interface PrecioProducto {
  orden: number;
  rol: RolPrecio;
  precio: string;
}

class PresentacionCreate {
  @IsInt()
  productoId: number;

  @IsString()
  @Length(1, 80)
  nombre: string; // "1 L", "500 ml", "Saco 46 kg"

  // Usar string para Decimal(18,6) y evitar pérdidas en JS
  @IsNumberString()
  factorUnidadBase: string; // "1000", "0.5", etc.

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sku?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  codigoBarras?: string;

  @IsOptional()
  @IsBoolean()
  esDefault?: boolean; // si true, forzará a ser la default

  preciosPresentacion: PrecioProducto[];
}
