import {
  IsArray,
  ArrayMinSize,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MaxLength,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

// Enum espejo de Prisma
export enum PedidoEstado {
  PENDIENTE = 'PENDIENTE',
  ENVIADO_COMPRAS = 'ENVIADO_COMPRAS',
  RECIBIDO = 'RECIBIDO',
  CANCELADO = 'CANCELADO',
}
export enum TipoLinea {
  PRESENTACION = 'PRESENTACION',
  PRODUCTO = 'PRODUCTO',
}
/**
 * DTO para una línea del pedido
 * - `subtotal` no se recibe: lo calcula el backend (cantidad × precioUnitario)
 */
export class CreatePedidoLineaDto {
  @IsInt()
  @Type(() => Number)
  @Min(1, { message: 'productoId inválido' })
  productoId?: number;

  @IsInt()
  @Type(() => Number)
  @Min(1, { message: 'presentacion ID inválido' })
  presentacionId?: number;

  @IsInt()
  @Type(() => Number)
  @Min(1, { message: 'La cantidad mínima es 1' })
  cantidad!: number;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Type(() => Number)
  @Min(0, { message: 'El precioUnitario no puede ser negativo' })
  precioUnitario!: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  notas?: string;
  //decidir si actualizar producto precio
  @IsBoolean()
  actualizarCosto: boolean;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  precioCostoActual: number;

  @IsEnum(TipoLinea)
  tipo: TipoLinea;
  @IsString()
  fechaVencimiento: string;
}
