// create-venta-cuota.dto.ts
import { IsInt, IsArray, IsEnum, IsString } from 'class-validator';

export enum Tipo { // 👈 EXPORTA EL ENUM
  PRODUCTO = 'PRODUCTO',
  PRESENTACION = 'PRESENTACION',
}

export class CreateVentaCuotaDto {
  @IsInt() clienteId: number;
  @IsInt() cuotaInicial: number;
  @IsInt() diasEntrePagos: number;
  @IsString() fechaContrato?: string;
  @IsString() fechaInicio?: string;
  @IsInt() garantiaMeses?: number;
  @IsInt() montoVenta: number;
  @IsInt() sucursalId: number;
  @IsInt() totalVenta: number;
  @IsInt() usuarioId: number;
  @IsInt()
  cuotasTotales: number;
  @IsArray()
  productos: ProductsList[];
  @IsInt()
  interes: number;
  @IsInt()
  montoTotalConInteres: number;
}

export class ProductsList {
  @IsInt() cantidad: number;
  @IsInt() precioVenta: number;
  @IsInt() productoId?: number;
  @IsInt() presentacionId?: number;
  @IsEnum(Tipo) tipo: Tipo;
}
