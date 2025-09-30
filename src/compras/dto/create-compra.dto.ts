// compras/dto/create-compra.dto.ts
import {
  IsArray,
  ArrayMinSize,
  IsInt,
  IsOptional,
  IsString,
  IsEnum,
  IsNumber,
  ValidateNested,
  IsISO8601,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TipoItemRecepcionParcial } from '../interfaces/types';

export class ItemDetallesPayloadParcial {
  @IsInt() compraDetalleId: number;
  @IsInt() itemId: number;
  @IsInt() id: number;

  @IsInt() cantidadRecibida: number;

  // Costo puede tener decimales:
  @IsNumber({ maxDecimalPlaces: 4 })
  precioCosto: number;

  @IsOptional()
  @IsISO8601() // o @IsString() si mandas "YYYY-MM-DD"
  fechaExpiracion?: string;

  @IsOptional()
  checked?: boolean;

  @IsEnum(TipoItemRecepcionParcial)
  tipo: TipoItemRecepcionParcial;
}

export class CreateCompraDto {
  @IsInt() compraId: number;
  @IsInt() usuarioId: number;
  @IsInt() sucursalId: number;

  @IsOptional()
  @IsISO8601() // o @IsString()
  fecha?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ItemDetallesPayloadParcial)
  lineas: ItemDetallesPayloadParcial[];
}
