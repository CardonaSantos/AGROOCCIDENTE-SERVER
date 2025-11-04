import {
  ClasificacionAdmin,
  CostoVentaTipo,
  GastoOperativoTipo,
  MetodoPago,
  MotivoMovimiento,
} from '@prisma/client';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString } from 'class-validator';

export class RecepcionarCompraAutoDto {
  @IsInt()
  compraId!: number;

  @IsInt()
  usuarioId!: number;

  @IsInt()
  proveedorId: number;

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsEnum(MetodoPago)
  metodoPago: MetodoPago;

  @IsNumber()
  @IsOptional()
  registroCajaId?: number;

  @IsInt()
  sucursalId: number;

  @IsInt()
  cuentaBancariaId: number;

  lineas?: lineasOverrride[];
  mf: MovimientoFinanciero;
}

class MovimientoFinanciero {
  sucursalId: number | undefined;
  motivo: MotivoMovimiento;
  clasificacionAdmin: ClasificacionAdmin | undefined;
  metodoPago: MetodoPago;
  descripcion: string;
  proveedorId: number;
  gastoOperativoTipo: GastoOperativoTipo;
  afectaInventario: boolean;
  monto: number;
  costoVentaTipo: CostoVentaTipo;
}

class lineasOverrride {
  fechaVencimiento: string;
  compraDetalleId: number;
  loteCodigo: string;
}
