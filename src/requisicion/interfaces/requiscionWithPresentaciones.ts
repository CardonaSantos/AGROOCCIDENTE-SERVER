import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class RequisicionLineasDTO {
  lineas: RequisicionAndPresentaciones[];
  @IsNumber()
  sucursalId: number;
  @IsNumber()
  usuarioId: number;
  @IsOptional()
  @IsString()
  observaciones?: string;
}
export class RequisicionAndPresentaciones {
  @IsBoolean()
  actualizarCosto: boolean;
  @IsNumber()
  cantidadSugerida: number;
  @IsString()
  fechaExpiracion: string;
  @IsString()
  precioCostoUnitario: string;
  @IsNumber()
  productoId: number;
  @IsNumber()
  presentacionId: number;
}
