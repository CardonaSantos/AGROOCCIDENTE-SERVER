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
} from 'class-validator';

const DECIMAL_14_2 = /^\d{1,12}(\.\d{1,2})?$/; // compatible con @db.Decimal(14,2)

export class CreateComprasPagoDto {
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  cuentaBancariaId: number;

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

  // ---- Comprobante opcional (para evidencias / matching en banco; el server decide cómo usarlo) ----
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
}
