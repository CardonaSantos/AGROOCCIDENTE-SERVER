// dto/create-solicitud-credito-venta.dto.ts
import {
  IsArray,
  ArrayMinSize,
  ValidateNested,
  IsInt,
  IsOptional,
  IsString,
  IsNumber,
  Min,
  Max,
  IsEnum,
  IsISO8601,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateSolicitudCreditoVentaLineaDto } from './create-solicitud-credito-venta-linea.dto';

// Alinea estos enums con los de tu dominio
export enum InteresTipoDto {
  NONE = 'NONE',
  SIMPLE = 'SIMPLE',
  COMPUESTO = 'COMPUESTO',
  PRIMERA_MAYOR = 'PRIMERA_MAYOR',
}
export enum PlanCuotaModoDto {
  IGUALES = 'IGUALES',
  CRECIENTES = 'CRECIENTES',
  DECRECIENTES = 'DECRECIENTES',
}

export class CreateSolicitudCreditoVentaDto {
  // Contexto
  @IsInt()
  sucursalId!: number;

  // Cliente registrado (opcional)…
  @IsOptional()
  @IsInt()
  clienteId?: number;

  // …o snapshot del cliente final si no existe en tabla
  @IsOptional()
  @IsString()
  nombreCliente?: string;

  @IsOptional()
  @IsString()
  telefonoCliente?: string;

  @IsOptional()
  @IsString()
  direccionCliente?: string;

  // Propuesta económica
  @IsNumber()
  @Min(0.01)
  totalPropuesto!: number;

  @IsNumber()
  @Min(0)
  cuotaInicialPropuesta!: number;

  @IsInt()
  @Min(1)
  cuotasTotalesPropuestas!: number;

  @IsEnum(InteresTipoDto)
  interesTipo!: InteresTipoDto;

  @IsInt()
  @Min(0)
  @Max(100)
  interesPorcentaje!: number;

  @IsEnum(PlanCuotaModoDto)
  planCuotaModo!: PlanCuotaModoDto;

  @IsInt()
  @Min(1)
  diasEntrePagos!: number;

  @IsOptional()
  @IsISO8601()
  fechaPrimeraCuota?: string; // ISO

  // Extras
  @IsOptional()
  @IsString()
  comentario?: string;

  @IsInt()
  @Min(0)
  garantiaMeses!: number;

  @IsOptional()
  @IsObject()
  testigos?: Record<string, any>;

  // Líneas del “carrito”
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSolicitudCreditoVentaLineaDto)
  lineas!: CreateSolicitudCreditoVentaLineaDto[];

  // (Opcional) si tu backend no lo toma del token:
  @IsOptional()
  @IsInt()
  solicitadoPorId?: number;
}
