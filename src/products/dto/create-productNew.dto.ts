import { RolPrecio, TipoEmpaque } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Matches,
  Min,
  ValidateNested,
  ArrayUnique,
} from 'class-validator';
import { Type } from 'class-transformer';

// Ajusta la escala a lo que uses en Prisma (@db.Decimal(18,6) por ejemplo)
const DECIMAL_RE = /^\d+(\.\d{1,6})?$/;

// --------- Sub-DTOs ---------

export class PrecioProductoDto {
  @IsEnum(RolPrecio)
  rol: RolPrecio;

  @IsInt()
  @Min(1)
  orden: number;

  // string decimal positivo (evita float JS)
  @IsString()
  @Matches(DECIMAL_RE, { message: 'precio debe ser decimal positivo' })
  precio: string;
}

export class PrecioPresentacionDto {
  @IsEnum(RolPrecio)
  rol: RolPrecio;

  @IsInt()
  @Min(1)
  orden: number;

  @IsString()
  @Matches(DECIMAL_RE, { message: 'precio debe ser decimal positivo' })
  precio: string;
}

export class PresentacionCreateDto {
  @IsString()
  @Length(1, 80)
  nombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  codigoBarras?: string;

  @IsOptional()
  @IsBoolean()
  esDefault?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrecioPresentacionDto)
  preciosPresentacion: PrecioPresentacionDto[];

  @IsEnum(TipoEmpaque)
  tipoPresentacion: TipoEmpaque;

  @IsString()
  costoReferencialPresentacion: string;
}

// --------- DTO principal ---------

export class CreateNewProductDto {
  @IsString()
  @Length(1, 255)
  nombre: string;

  @IsString()
  @Length(1, 100)
  codigoProducto: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  codigoProveedor?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  descripcion?: string | null;

  // ✔ precios a nivel producto
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrecioProductoDto)
  precioVenta: PrecioProductoDto[];

  @IsInt()
  creadoPorId: number;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  categorias?: number[];

  // ✔ string decimal o null
  @IsOptional()
  @IsString()
  @Matches(DECIMAL_RE, {
    message: 'precioCostoActual debe ser decimal positivo',
  })
  precioCostoActual?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  stockMinimo?: number | null;

  // ❌ No incluimos imágenes aquí; van como archivos en el controller.

  // ✔ varias presentaciones
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PresentacionCreateDto)
  presentaciones?: PresentacionCreateDto[];
}
