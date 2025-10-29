// notification.types.ts
import { NotiCategory, NotiSeverity } from '@prisma/client';

export type UiNotificacionDTO = {
  id: number;
  titulo: string | null;
  mensaje: string;
  categoria: NotiCategory;
  subtipo: string | null;
  severidad: NotiSeverity;
  route: string | null;
  actionLabel: string | null;
  meta?: Record<string, any> | null;
  referencia?: { tipo: string | null; id: number | null } | null;
  sucursalId: number | null;

  // estado por usuario
  leido: boolean;
  eliminado: boolean;
  recibidoEn: string; // ISO
  leidoEn: string | null;
  dismissedAt: string | null;

  // emisor minimal
  remitente?: { id: number; nombre: string | null } | null;
};
