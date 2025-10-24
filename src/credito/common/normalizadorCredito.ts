// utils/normalize-creditos.ts
import { CreditoArrayResponse } from '../select/select-creditosResponse';

// utils/normalize-creditos.ts

type NormLineaVenta = {
  id: number;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  item: {
    type: 'PRODUCTO' | 'PRESENTACION'; // <— NUEVO
    source: 'producto' | 'presentacion'; // <— NUEVO (útil para el POS)
    uid: string; // <— NUEVO, ej: "presentacion-1" o "producto-32"

    productoId?: number;
    presentacionId?: number;

    // Nombres “crudos” por si quieres mostrarlos por separado
    nombreProducto?: string | null;
    nombrePresentacion?: string | null;

    // Nombre “principal” segun el type
    nombre: string;

    // Códigos correctos según el type
    codigoProducto?: string | null;
    codigoBarras?: string | null;

    imagen?: string | null;
  };
};

type NormCuota = {
  id: number;
  numero: number;
  fechaVencimientoISO: string | null;
  fechaPagoISO: string | null;
  estado: string;
  monto: number;
  pagado: number;
  saldoPendiente: number;
  moraAcumulada: number;
  abonos: {
    count: number;
    lastPagoISO: string | null;
  };
};

type NormAbono = {
  id: number;
  fechaISO: string;
  metodoPago: string;
  referencia?: string | null;
  montoTotal: number;
  usuario: { id: number; nombre: string };
  sucursal: { id: number; nombre: string };
  desglose: Array<{
    cuotaId: number;
    capital: number;
    interes: number;
    mora: number;
    total: number;
  }>;
};

export type NormalizedCredito = {
  id: number;
  numeroCredito?: string | null;
  estado: string;
  fechas: {
    inicioISO: string;
    proximoPagoISO: string | null;
    contratoISO: string;
    creadoISO: string;
    actualizadoISO: string;
  };
  sucursal: { id: number; nombre: string; tipoSucursal: string };
  cliente: {
    id: number;
    nombre: string;
    apellidos?: string | null;
    dpi?: string | null;
    telefono?: string | null;
    direccion?: string | null;
  };
  usuario: { id: number; nombre: string };
  plan: {
    cuotasTotales: number;
    frecuenciaPago: string;
    modo: string;
    interesTipo: string;
    interesTasa?: number; // tu campo "interes" entero original
    cuotaInicial: number;
    diasGracia: number;
    moraDiaria: number;
    diasEntrePagos: number;
  };
  montos: {
    venta: number;
    totalPagado: number;
    totalProgramado: number | null; // montoTotalConInteres si existe
    moraAcumulada: number;
  };
  venta?: {
    id: number;
    fechaISO: string;
    total: number;
    referenciaPago?: string | null;
    tipoComprobante: string;
    imei?: string | null;
    vendedor?: { id: number; nombre: string } | null;
    metodoPago?: {
      id: number;
      metodoPago: string;
      monto: number;
      fechaISO: string;
    } | null;
    lineas: NormLineaVenta[];
    solicitudOrigen?: {
      id: number;
      estado: string;
      fechaSolicitudISO: string;
      fechaRespuestaISO?: string | null;
      solicitadoPor?: { id: number; nombre: string } | null;
      aprobadoPor?: { id: number; nombre: string } | null;
      lineas: Array<{
        id: number;
        cantidad: number;
        precioUnitario: number;
        subtotal: number;
        item: {
          nombre: string;
          codigoProducto?: string | null;
          presentacion?: string | null;
          codigoBarras?: string | null;
        };
      }>;
      historial: Array<{
        id: number;
        accion: string;
        comentario?: string | null;
        fechaISO: string;
        actor?: { id: number; nombre: string } | null;
      }>;
    } | null;
  } | null;
  cuotas: {
    resumen: {
      total: number;
      pagadas: number;
      pendientes: number;
      atrasadas: number;
      parcial: number;
    };
    proxima?: NormCuota | null;
    items: NormCuota[];
  };
  abonos: {
    count: number;
    ultimoISO: string | null;
    items: NormAbono[];
  };
  historial: Array<{
    id: number;
    accion: string;
    comentario?: string | null;
    fechaISO: string;
    usuario?: { id: number; nombre: string } | null;
  }>;
};

export function normalizerCreditoRegist(
  creditos: CreditoArrayResponse,
): NormalizedCredito[] {
  return creditos.map((c) => {
    // Venta (opcional)
    const venta = c.venta
      ? {
          id: c.venta.id,
          fechaISO: c.venta.fechaVenta.toISOString(),
          total: c.venta.totalVenta,
          referenciaPago: c.venta.referenciaPago ?? null,
          tipoComprobante: String(c.venta.tipoComprobante),
          imei: c.venta.imei ?? null,
          vendedor: c.venta.usuario
            ? { id: c.venta.usuario.id, nombre: c.venta.usuario.nombre }
            : null,
          metodoPago: c.venta.metodoPago
            ? {
                id: c.venta.metodoPago.id,
                metodoPago: String(c.venta.metodoPago.metodoPago),
                monto: c.venta.metodoPago.monto,
                fechaISO: c.venta.metodoPago.fechaPago.toISOString(),
              }
            : null,
          lineas: (c.venta.productos ?? []).map<NormLineaVenta>((vp) => {
            // Relaciones (pueden venir null según tu SELECT)
            const p = vp.producto ?? undefined;
            const pr = vp.presentacion ?? undefined;

            // Snapshots/fallbacks (ajusta los nombres si en tu schema difieren)
            const nombrePrSnap = (vp as any).presentacionNombreSnapshot ?? null;
            const nombreProdSnap = (vp as any).nombreProductoSnapshot ?? null;
            const codigoBarrasSnap = (vp as any).codigoBarrasSnapshot ?? null;
            const codigoProdSnap = (vp as any).codigoProductoSnapshot ?? null;

            // ¿Fue una presentación? (no dependas solo de la relación)
            const wasPresentacion =
              !!pr?.id ||
              !!(vp as any).presentacionId ||
              !!codigoBarrasSnap ||
              !!nombrePrSnap;

            // Texto de nombre unificado (lo que quieres: si hay PR, usa PR; si no, PROD)
            const nombreFromPr = pr?.nombre ?? nombrePrSnap ?? null;
            const nombreFromProd = p?.nombre ?? nombreProdSnap ?? null;
            const nombre = wasPresentacion
              ? (nombreFromPr ?? nombreFromProd ?? 'Ítem')
              : (nombreFromProd ?? nombreFromPr ?? 'Ítem');

            // IDs unificados
            const productoId =
              pr?.producto?.id ?? p?.id ?? (vp as any).productoId ?? undefined;

            const presentacionId = wasPresentacion
              ? (pr?.id ?? (vp as any).presentacionId ?? undefined)
              : undefined;

            // Código(s)
            const codigoProducto = p?.codigoProducto ?? codigoProdSnap ?? null;
            const codigoBarras = wasPresentacion
              ? (pr?.codigoBarras ?? codigoBarrasSnap ?? null)
              : null;

            // Fuente/tipo (solo metadatos; tu UI puede ignorarlos si quiere tratarlos “como producto”)
            const type: 'PRESENTACION' | 'PRODUCTO' = wasPresentacion
              ? 'PRESENTACION'
              : 'PRODUCTO';
            const source = wasPresentacion ? 'presentacion' : 'producto';

            // UID estable (si vino por snapshot sin id, marca 'snap' para no colisionar)
            const uid = wasPresentacion
              ? `presentacion-${presentacionId ?? 'snap'}`
              : `producto-${productoId ?? vp.id}`;

            // Imagen: prioriza la del producto (suele ser la estable)
            const imagen = p?.imagenesProducto?.[0]?.url;

            return {
              id: vp.id,
              cantidad: vp.cantidad,
              precioUnitario: vp.precioVenta,
              subtotal: vp.cantidad * vp.precioVenta,
              item: {
                type,
                source,
                uid,

                productoId,
                presentacionId,
                // El nombre “único” que pediste
                nombre,
                // Códigos correctos según el tipo
                codigoProducto,
                codigoBarras,

                imagen: imagen,
              },
            };
          }),

          solicitudOrigen: c.venta.solicitudCredito
            ? {
                id: c.venta.solicitudCredito.id,
                estado: String(c.venta.solicitudCredito.estado),
                fechaSolicitudISO:
                  c.venta.solicitudCredito.fechaSolicitud.toISOString(),
                fechaRespuestaISO:
                  c.venta.solicitudCredito.fechaRespuesta?.toISOString() ??
                  null,
                solicitadoPor: c.venta.solicitudCredito.solicitadoPor
                  ? {
                      id: c.venta.solicitudCredito.solicitadoPor.id,
                      nombre: c.venta.solicitudCredito.solicitadoPor.nombre,
                    }
                  : null,
                aprobadoPor: c.venta.solicitudCredito.aprobadoPor
                  ? {
                      id: c.venta.solicitudCredito.aprobadoPor.id,
                      nombre: c.venta.solicitudCredito.aprobadoPor.nombre,
                    }
                  : null,
                lineas: (c.venta.solicitudCredito.lineas ?? []).map((ln) => ({
                  id: ln.id,
                  cantidad: ln.cantidad,
                  precioUnitario: ln.precioUnitario,
                  subtotal: ln.subtotal,
                  item: {
                    nombre:
                      ln.producto?.nombre ??
                      ln.presentacion?.nombre ??
                      ln.nombreProductoSnapshot ??
                      'Ítem',
                    codigoProducto: ln.producto?.codigoProducto ?? null,
                    presentacion:
                      ln.presentacion?.nombre ??
                      ln.presentacionNombreSnapshot ??
                      null,
                    codigoBarras:
                      ln.presentacion?.codigoBarras ??
                      ln.codigoBarrasSnapshot ??
                      null,
                  },
                })),
                historial: (c.venta.solicitudCredito.historial ?? []).map(
                  (h) => ({
                    id: h.id,
                    accion: String(h.accion),
                    comentario: h.comentario ?? null,
                    fechaISO: h.fecha.toISOString(),
                    actor: h.actor
                      ? { id: h.actor.id, nombre: h.actor.nombre }
                      : null,
                  }),
                ),
              }
            : null,
        }
      : null;

    // Cuotas
    const cuotasItems = (c.cuotas ?? []).map<NormCuota>((q) => {
      const lastPagoISO = q.abonos?.length
        ? q.abonos[q.abonos.length - 1].abono.fechaAbono.toISOString()
        : null;
      const saldo =
        typeof q.saldoPendiente === 'number'
          ? q.saldoPendiente
          : Math.max(0, (q.monto ?? 0) - (q.montoPagado ?? 0));
      return {
        id: q.id,
        numero: q.numero,
        fechaVencimientoISO: q.fechaVencimiento
          ? q.fechaVencimiento.toISOString()
          : null,
        fechaPagoISO: q.fechaPago ? q.fechaPago.toISOString() : null,
        estado: String(q.estado),
        monto: q.monto ?? q.montoEsperado ?? 0,
        pagado: q.montoPagado ?? 0,
        saldoPendiente: saldo,
        moraAcumulada: q.moraAcumulada ?? 0,
        abonos: {
          count: q.abonos?.length ?? 0,
          lastPagoISO,
        },
      };
    });

    const cuotasResumen = {
      total: cuotasItems.length,
      pagadas: cuotasItems.filter((x) => x.estado === 'PAGADA').length,
      pendientes: cuotasItems.filter((x) => x.estado === 'PENDIENTE').length,
      atrasadas: cuotasItems.filter((x) => x.estado === 'ATRASADA').length,
      parcial: cuotasItems.filter((x) => x.estado === 'PARCIAL').length,
    };

    const proxima =
      cuotasItems
        .filter((x) => x.estado !== 'PAGADA' && x.fechaVencimientoISO)
        .sort((a, b) =>
          (a.fechaVencimientoISO ?? '').localeCompare(
            b.fechaVencimientoISO ?? '',
          ),
        )[0] || null;

    // Abonos
    const abonosItems = (c.abonos ?? []).map<NormAbono>((a) => ({
      id: a.id,
      fechaISO: a.fechaAbono.toISOString(),
      metodoPago: String(a.metodoPago),
      referencia: a.referenciaPago ?? null,
      montoTotal: a.montoTotal,
      usuario: { id: a.usuario.id, nombre: a.usuario.nombre },
      sucursal: { id: a.sucursal.id, nombre: a.sucursal.nombre },
      desglose: (a.detalles ?? []).map((d) => ({
        cuotaId: d.cuotaId,
        capital: d.montoCapital,
        interes: d.montoInteres,
        mora: d.montoMora,
        total: d.montoTotal,
      })),
    }));
    const abonosUltimo = abonosItems[0]?.fechaISO ?? null;

    const moraTotal =
      cuotasItems.reduce((sum, q) => sum + (q.moraAcumulada ?? 0), 0) || 0;

    return {
      id: c.id,
      numeroCredito: c.numeroCredito ?? null,
      estado: String(c.estado),
      fechas: {
        inicioISO: c.fechaInicio.toISOString(),
        proximoPagoISO: c.fechaProximoPago
          ? c.fechaProximoPago.toISOString()
          : null,
        contratoISO: c.fechaContrato.toISOString(),
        creadoISO: c.creadoEn.toISOString(),
        actualizadoISO: c.actualizadoEn.toISOString(),
      },
      sucursal: {
        id: c.sucursal.id,
        nombre: c.sucursal.nombre,
        tipoSucursal: String(c.sucursal.tipoSucursal),
      },
      cliente: {
        id: c.cliente.id,
        nombre: c.cliente.nombre,
        apellidos: c.cliente.apellidos ?? null,
        dpi: c.cliente.dpi ?? null,
        telefono: c.cliente.telefono ?? null,
        direccion: c.cliente.direccion ?? null,
      },
      usuario: { id: c.usuario.id, nombre: c.usuario.nombre },
      plan: {
        cuotasTotales: c.cuotasTotales,
        frecuenciaPago: String(c.frecuenciaPago),
        modo: String(c.planCuotaModo),
        interesTipo: String(c.interesTipo),
        interesTasa: c.interes ?? undefined,
        cuotaInicial: c.cuotaInicial,
        diasGracia: c.diasGracia,
        moraDiaria: c.moraDiaria,
        diasEntrePagos: c.diasEntrePagos,
      },
      montos: {
        venta: c.montoVenta,
        totalPagado: c.totalPagado,
        totalProgramado: c.montoTotalConInteres ?? null,
        moraAcumulada: moraTotal,
      },
      venta,
      cuotas: {
        resumen: cuotasResumen,
        proxima,
        items: cuotasItems,
      },
      abonos: {
        count: abonosItems.length,
        ultimoISO: abonosUltimo,
        items: abonosItems,
      },
      historial: (c.historial ?? []).map((h) => ({
        id: h.id,
        accion: String(h.accion),
        comentario: h.comentario ?? null,
        fechaISO: h.fecha.toISOString(),
        usuario: h.usuario
          ? { id: h.usuario.id, nombre: h.usuario.nombre }
          : null,
      })),
    };
  });
}
