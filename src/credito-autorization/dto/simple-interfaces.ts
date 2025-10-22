import { OrigenCuotaPropuesta, TipoCuotaPropuesta } from '@prisma/client';

export interface cuotasPropuestas {
  id: number;
  numero: number;
  fecha: Date;
  monto: number;
  etiqueta: TipoCuotaPropuesta;
  origen: OrigenCuotaPropuesta;
  esManual: boolean;
  montoCapital: number;
  montoInteres: number;
}
