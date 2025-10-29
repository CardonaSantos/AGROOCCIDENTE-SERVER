// notification.formatter.ts

import { UiNotificacionDTO } from './UINotificationDto';

export const toUiNotificacion = (row: {
  id: number;
  recibidoEn: Date;
  leido: boolean;
  eliminado: boolean;
  leidoEn: Date | null;
  dismissedAt: Date | null;
  notificacion: {
    id: number;
    titulo: string | null;
    mensaje: string;
    categoria: any;
    subtipo: string | null;
    severidad: any;
    route: string | null;
    actionLabel: string | null;
    meta: any | null;
    referenciaTipo: string | null;
    referenciaId: number | null;
    sucursalId: number | null;
    remitente?: { id: number; nombre: string | null } | null;
  };
}): UiNotificacionDTO => {
  const n = row.notificacion;
  return {
    id: n.id,
    titulo: n.titulo ?? 'Notificación',
    mensaje: n.mensaje ?? '',
    categoria: n.categoria,
    subtipo: n.subtipo ?? null,
    severidad: n.severidad,
    route: n.route ?? null,
    actionLabel: n.actionLabel ?? null,
    meta: (n.meta as any) ?? null,
    referencia: { tipo: n.referenciaTipo, id: n.referenciaId },
    sucursalId: n.sucursalId ?? null,

    leido: row.leido,
    eliminado: row.eliminado,
    recibidoEn: row.recibidoEn.toISOString(),
    leidoEn: row.leidoEn ? row.leidoEn.toISOString() : null,
    dismissedAt: row.dismissedAt ? row.dismissedAt.toISOString() : null,

    remitente: n.remitente
      ? { id: n.remitente.id, nombre: n.remitente.nombre ?? null }
      : null,
  };
};
