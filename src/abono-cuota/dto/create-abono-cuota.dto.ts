import { MetodoPago } from '@prisma/client';

export class detalles {
  cuotaId: number;
  montoTotal: number;
}
export class CreateAbonoCuotaDto {
  detalles: detalles;
  metodoPago: MetodoPago;
  montoTotal: number;
  referenciaPago: string;
  sucursalId: number;
  usuarioId: number;
  ventaCuotaId: number;
}
