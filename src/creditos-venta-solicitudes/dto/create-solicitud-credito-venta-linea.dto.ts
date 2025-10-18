// dto/create-solicitud-credito-venta-linea.dto.ts
import { IsInt, IsNumber, IsOptional, Min, Validate } from 'class-validator';

export class CreateSolicitudCreditoVentaLineaDto {
  @IsOptional()
  @IsInt()
  productoId?: number;

  @IsOptional()
  @IsInt()
  presentacionId?: number;

  @IsInt()
  @Min(1)
  cantidad!: number;

  @IsNumber()
  @Min(0.01)
  precioUnitario!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  precioListaRef?: number;

  @IsOptional()
  @IsNumber()
  descuento?: number;

  // Subtotal lo puede enviar el UI, pero el server debe recalcular/validar.
  @IsOptional()
  @IsNumber()
  @Min(0)
  subtotal?: number;

  // Snapshots opcionales
  @IsOptional()
  nombreProductoSnapshot?: string;

  @IsOptional()
  presentacionNombreSnapshot?: string;

  @IsOptional()
  codigoBarrasSnapshot?: string;
}
