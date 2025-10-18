import { EstadoSolicitud, InteresTipo, PlanCuotaModo } from '@prisma/client';
import { IsArray, IsEnum, IsInt, IsOptional, IsString } from 'class-validator';

export type flagItem = 'PRODUCTO' | 'PRESENTACION';
export class CreateCreditoAutorizationDto {
  @IsInt({
    message: 'Sucursal ID no válido',
  })
  sucursalId: number;

  @IsInt()
  clienteId: number;
  @IsInt()
  totalPropuesto: number; //total credito

  @IsInt()
  @IsOptional()
  cuotaInicialPropuesta: number;

  @IsInt()
  @IsOptional()
  cuotasTotalesPropuestas: number;

  @IsEnum(InteresTipo)
  interesTipo: InteresTipo;

  @IsInt()
  interesPorcentaje: number;

  @IsEnum(PlanCuotaModo)
  planCuotaModo: PlanCuotaModo;

  @IsInt()
  diasEntrePagos: number;

  @IsString()
  fechaPrimeraCuota: string;

  @IsString()
  comentario: string;

  @IsEnum(EstadoSolicitud)
  @IsOptional()
  estado: EstadoSolicitud;

  @IsInt()
  solicitadoPorId: number;

  @IsInt()
  @IsOptional()
  aprobadoPorId: number;

  @IsString()
  @IsOptional()
  fechaRespuesta: string;

  @IsString()
  @IsOptional()
  motivoRechazo: string;

  @IsInt()
  @IsOptional()
  ventaId: number;

  @IsArray({
    always: true,
  })
  lineas: SolicitudCreditoVentaLinea[];
}

export class SolicitudCreditoVentaLinea {
  @IsInt()
  @IsOptional()
  solicitudId: number;

  @IsInt()
  @IsOptional()
  productoId: number;

  @IsInt()
  @IsOptional()
  presentacionId: number;

  @IsInt()
  cantidad: number;

  @IsInt()
  precioUnitario: number;

  @IsInt()
  precioListaRef: number; //total de la lista de items

  @IsInt()
  subtotal: number; //total del credito(con interés y cuotas, diferente de los productos lista)
  flagItem: flagItem;
}
