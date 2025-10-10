import { InteresTipo, MetodoPago, PlanCuotaModo } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export type GeneracionModo = 'POR_COMPRA' | 'POR_RECEPCION';

export type PlanCuotaFila = {
  numero: number;
  fechaISO: string;
  monto: number;
  id: string;
};

export type PlanPreview = {
  cuotas: PlanCuotaFila[];
  interesTotal: number;
  principalFinanciado: number; // total - enganche
  totalAPagar: number; // suma de cuotas
};

export class CreateDocumentoDto {
  @IsInt({ message: 'Proveedor ID no proporcionado' })
  proveedorId: number;

  @IsInt({ message: 'Compra ID no proporcionado' })
  compraId: number;

  @IsIn(['POR_COMPRA', 'POR_RECEPCION'], {
    message: 'Modo de generación inválido',
  })
  modo: PlanCuotaModo;

  @IsOptional()
  @IsInt({ message: 'Recepción ID debe ser un número válido' })
  recepcionId?: number;

  @IsInt({ message: 'Usuario ID no proporcionado' })
  usuarioId: number;

  @IsOptional()
  @IsNumber({}, { message: 'montoOriginal debe ser numérico' })
  montoOriginal?: number; // por defecto: total de compra o valor de recepción

  @IsString({ message: 'fechaEmisionISO no proporcionado' })
  fechaEmisionISO: string; // ISO date string

  @IsString({ message: 'fechaEmisionISO no proporcionado' })
  @IsString()
  fechaVencimiento?: string;

  @IsInt({ message: 'diasCredito no proporcionado' })
  diasCredito: number; // Net X

  @IsInt({ message: 'diasEntrePagos no proporcionado' })
  diasEntrePagos: number; // frecuencia entre cuotas

  @IsInt({ message: 'cantidadCuotas no proporcionado' })
  cantidadCuotas: number; // total de cuotas

  @IsEnum(InteresTipo, { message: 'Tipo de interés inválido' })
  interesTipo: InteresTipo;

  @IsNumber({}, { message: 'interes debe ser un número' })
  interes: number; // tasa por periodo (ej. 0, 0.02)

  @IsEnum(PlanCuotaModo, { message: 'Modo de plan de cuotas inválido' })
  planCuotaModo: PlanCuotaModo;

  @IsOptional()
  @IsNumber({}, { message: 'Enganche debe ser numérico' })
  enganche?: number; // si modo PRIMERA_MAYOR

  @IsBoolean()
  registrarPagoEngancheAhora: boolean;

  //relacion al pago metodo
  @IsEnum(MetodoPago)
  metodoPago: MetodoPago;

  @IsNumber({}, { message: 'sucursalId debe ser numérico' })
  sucursalId: number;

  @IsString()
  @IsOptional()
  descripcion: string;

  @IsNumber({}, { message: 'cuentaBancariaId debe ser numérico' })
  @IsOptional()
  cuentaBancariaId: number;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => Object)
  cuotas?: PlanCuotaFila[];
}
