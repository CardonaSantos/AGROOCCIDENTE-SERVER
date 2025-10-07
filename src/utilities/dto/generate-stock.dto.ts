import { Type } from 'class-transformer';
import { IsDate, IsInt, IsNumber, IsOptional, IsString } from 'class-validator';

export class GenerateStockDto {
  @IsInt()
  productoId: number;
  @IsInt()
  cantidad: number;
  @IsNumber()
  costoTotal: number;
  @IsString()
  @IsOptional()
  fechaIngreso: string;
  @IsString()
  @IsOptional()
  @Type(() => Date) // <— añade esto
  @IsDate()
  fechaExpiracion?: Date | null;
  @IsNumber()
  precioCosto: number;
  @IsInt()
  sucursalId: number;
  @IsInt()
  @IsOptional()
  requisicionRecepcionId?: number;
}
