// dto/aprobar-solicitud-credito-venta.dto.ts
import {
  IsInt,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  Max,
  IsISO8601,
  IsString,
} from 'class-validator';
import {
  InteresTipoDto,
  PlanCuotaModoDto,
} from './create-solicitud-credito-venta.dto';

export class AprobarSolicitudCreditoVentaDto {
  // Permite ajustar condiciones al aprobar:
  @IsOptional()
  @IsNumber()
  @Min(0)
  cuotaInicial?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  cuotasTotales?: number;

  @IsOptional()
  @IsEnum(InteresTipoDto)
  interesTipo?: InteresTipoDto;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  interesPorcentaje?: number;

  @IsOptional()
  @IsEnum(PlanCuotaModoDto)
  planCuotaModo?: PlanCuotaModoDto;

  @IsOptional()
  @IsInt()
  @Min(1)
  diasEntrePagos?: number;

  @IsOptional()
  @IsISO8601()
  fechaPrimeraCuota?: string;

  @IsOptional()
  @IsString()
  comentario?: string;
}
