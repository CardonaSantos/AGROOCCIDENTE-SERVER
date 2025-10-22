import { MetodoPago } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';

export class AcceptCreditoDTO {
  @IsInt({
    message: 'ID de crédito no válido',
  })
  authCreditoId: number;
  @IsInt({
    message: 'adminId no válido',
  })
  adminId: number;

  @IsEnum(MetodoPago)
  @IsOptional()
  metodoPago: MetodoPago;

  @IsInt({
    message: 'cuentaBancariaId no válido',
  })
  @IsOptional()
  cuentaBancariaId: number;

  @IsInt({
    message: 'cuentaBancariaId no válido',
  })
  @IsOptional()
  cajaId: number;

  @IsOptional()
  @IsString()
  comentario: string;
}
