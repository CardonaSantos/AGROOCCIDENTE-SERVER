import { IsInt, IsOptional, IsString } from 'class-validator';

export class RejectCreditoAuth {
  @IsInt()
  authId: number; // solicitudCreditoVenta.id

  @IsInt()
  adminId: number; // usuario que rechaza

  @IsInt()
  sucursalId: number;

  @IsString()
  motivoRechazo: string;

  @IsOptional()
  @IsString()
  comentario?: string;
}
