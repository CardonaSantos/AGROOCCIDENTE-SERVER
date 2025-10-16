// dto/create-compras-pago.dto.ts
import { ComprobanteTipo, MetodoPago } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsPositive,
  IsEnum,
  IsOptional,
  IsString,
  IsISO8601,
  Matches,
  MaxLength,
  ValidateNested,
  ArrayNotEmpty,
  IsIn,
  Min,
} from 'class-validator';

const DECIMAL_14_2 = /^\d{1,12}(\.\d{1,2})?$/; // @db.Decimal(14,2)

// ---------------- Recepción anidada ----------------
export class CreateRecepcionItemDto {
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  compraDetalleId!: number;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  refId!: number;

  @IsIn(['PRESENTACION', 'PRODUCTO'])
  tipo!: 'PRESENTACION' | 'PRODUCTO';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  cantidad!: number;

  @IsOptional()
  @IsISO8601({ strict: true })
  fechaVencimientoISO?: string | null;
}

export class CreateRecepcionDesdeCreditoDto {
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  compraId!: number;

  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateRecepcionItemDto)
  items!: CreateRecepcionItemDto[];
}

// --------------- Pago + Recepción (unificado) ---------------
export class CreateComprasPagoConRecepcionDto {
  // --- canal de pago (deja ambos opcionales; valida en servicio según metodoPago)
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  cuentaBancariaId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  cajaId?: number;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  documentoId!: number;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  sucursalId!: number;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  cuotaId!: number;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  registradoPorId!: number;

  @IsOptional()
  @IsISO8601()
  fechaPago?: string;

  @IsEnum(MetodoPago)
  metodoPago!: MetodoPago;

  @Matches(DECIMAL_14_2, { message: 'monto debe ser Decimal(14,2)' })
  monto!: string;

  @IsOptional()
  @Matches(DECIMAL_14_2, {
    message: 'expectedCuotaSaldo debe ser Decimal(14,2)',
  })
  expectedCuotaSaldo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  referencia?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string;

  // ---- Comprobante opcional ----
  @IsOptional()
  @IsEnum(ComprobanteTipo)
  comprobanteTipo?: ComprobanteTipo;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  comprobanteNumero?: string;

  @IsOptional()
  @IsISO8601({ strict: false })
  comprobanteFecha?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comprobanteUrl?: string;

  // ---- NUEVO: bloque recepcion opcional ----
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateRecepcionDesdeCreditoDto)
  recepcion?: CreateRecepcionDesdeCreditoDto;
}
