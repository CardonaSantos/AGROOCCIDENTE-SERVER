import { MetodoPago, TipoComprobante } from '@prisma/client';
import {
  IsDate,
  IsArray,
  IsEnum,
  IsNumber,
  IsInt,
  IsString,
  IsOptional,
} from 'class-validator';

export class CreateVentaDto {
  @IsString()
  @IsOptional()
  referenciaPago: string;

  @IsEnum(TipoComprobante)
  tipoComprobante: TipoComprobante;

  @IsNumber()
  @IsOptional()
  clienteId?: number; // Si es un cliente existente

  @IsNumber()
  @IsOptional()
  usuarioId?: number; // Si es un cliente existente

  @IsString()
  @IsOptional()
  nombre?: string;

  @IsString()
  @IsOptional()
  apellidos?: string;

  @IsString()
  @IsOptional()
  dpi?: string;

  @IsString()
  @IsOptional()
  iPInternet?: string;

  @IsString()
  @IsOptional()
  telefono?: string;

  @IsString()
  @IsOptional()
  direccion?: string;

  @IsArray()
  productos: Array<{
    productoId: number;
    cantidad: number;
    selectedPriceId: number;
    presentacionId: number | null;
  }>;

  @IsEnum(MetodoPago)
  metodoPago: MetodoPago;

  @IsNumber()
  monto: number;

  @IsInt()
  sucursalId: number;

  @IsString()
  @IsOptional()
  imei?: string; // Campo opcional para IMEI

  @IsString()
  @IsOptional()
  observaciones?: string;
}
