// dto/rechazar-solicitud-credito-venta.dto.ts
import { IsString } from 'class-validator';

export class RechazarSolicitudCreditoVentaDto {
  @IsString()
  motivo!: string;
}
