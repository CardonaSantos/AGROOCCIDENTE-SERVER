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
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ClasificacionAdmin,
  CostoVentaTipo,
  MetodoPago,
  MotivoMovimiento,
} from '@prisma/client';
import { TipoItemRecepcionParcial } from '../interfaces/types';

export class ItemDetallesPayloadParcial {
  @IsInt() compraDetalleId: number;
  @IsInt() itemId: number;
  @IsInt() id: number;

  @IsInt() cantidadRecibida: number;

  @IsNumber({ maxDecimalPlaces: 4 })
  precioCosto: number;

  @IsOptional()
  @IsISO8601() // o @IsString('YYYY-MM-DD')
  fechaExpiracion?: string;

  @IsOptional()
  checked?: boolean;

  @IsEnum(TipoItemRecepcionParcial)
  tipo: TipoItemRecepcionParcial;
}

/** MF que viene del diálogo de "Costo asociado" */
export class MovimientoFinancieroParcialDto {
  @IsOptional() @IsInt() sucursalId?: number;
  @IsOptional() @IsInt() proveedorId?: number;

  @IsEnum(MotivoMovimiento) motivo!: MotivoMovimiento; // 'COSTO_ASOCIADO'
  @IsEnum(ClasificacionAdmin) clasificacionAdmin!: ClasificacionAdmin; // 'COSTO_VENTA'
  @IsEnum(MetodoPago) metodoPago!: MetodoPago;

  @IsString() descripcion!: string;
  @IsNumber() monto!: number;

  @IsEnum(CostoVentaTipo) costoVentaTipo!: CostoVentaTipo; // FLETE, etc.

  @IsOptional() @IsInt() cuentaBancariaId?: number; // si BANCO
  @IsOptional() @IsInt() registroCajaId?: number; // si CAJA
}

/** Meta mínima para activar prorrateo en la recepción parcial */
export class ProrrateoParcialDto {
  @IsBoolean() aplicar!: boolean;
  @IsEnum(['COSTO', 'CANTIDAD'] as any) base!: 'COSTO' | 'CANTIDAD';
  @IsOptional() @IsBoolean() incluirAntiguos?: boolean;
}

export class CreateCompraDto {
  @IsInt() compraId: number;
  @IsInt() usuarioId: number;
  @IsInt() sucursalId: number;

  @IsOptional() @IsISO8601() fecha?: string;
  @IsOptional() @IsString() observaciones?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ItemDetallesPayloadParcial)
  lineas: ItemDetallesPayloadParcial[];

  // NUEVO:
  @IsOptional()
  @ValidateNested()
  @Type(() => MovimientoFinancieroParcialDto)
  mf?: MovimientoFinancieroParcialDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ProrrateoParcialDto)
  prorrateo?: ProrrateoParcialDto;

  /** Alias por compatibilidad */
  @IsOptional() @IsBoolean() aplicarProrrateo?: boolean;
}
