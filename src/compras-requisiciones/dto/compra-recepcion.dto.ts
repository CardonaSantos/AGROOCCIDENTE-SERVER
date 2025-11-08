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
  proveedorId!: number;

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsEnum(MetodoPago)
  metodoPago!: MetodoPago;

  @IsOptional() // ✅ efectivo/contado no usa banco
  @IsInt()
  cuentaBancariaId?: number;

  @IsOptional()
  @IsNumber()
  registroCajaId?: number;

  @IsInt()
  sucursalId!: number;

  @IsOptional()
  lineas?: lineasOverrride[];

  aplicarProrrateo?: boolean;

  mf?: MovimientoFinanciero; // ✅ hazlo opcional si se permite sin costo
  prorrateo?: {
    aplicar: boolean;
    base: 'COSTO' | 'CANTIDAD';
    incluirAntiguos?: boolean;
  };
}

class MovimientoFinanciero {
  sucursalId?: number;
  motivo!: MotivoMovimiento; // 'COSTO_ASOCIADO' | 'COMPRA_MERCADERIA'
  clasificacionAdmin?: ClasificacionAdmin; // para COSTO_ASOCIADO => 'COSTO_VENTA'
  metodoPago!: MetodoPago;
  descripcion!: string;
  proveedorId!: number;

  cuentaBancariaId?: number;
  registroCajaId?: number;
  @IsOptional() // ✅ sólo si clasificacionAdmin === 'GASTO_OPERATIVO'
  gastoOperativoTipo?: GastoOperativoTipo;

  afectaInventario!: boolean; // true para prorratear
  monto!: number;
  costoVentaTipo!: CostoVentaTipo; // FLETE/ENCOMIENDA/...
}

class lineasOverrride {
  fechaVencimiento: string;
  compraDetalleId: number;
  loteCodigo: string;
}
