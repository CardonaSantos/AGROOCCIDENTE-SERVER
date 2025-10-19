// utils/normalize-credit-authorization.ts

import { SelectedCreditoAutorization } from '../helpers/select';

type NormalizedLinea = {
  id: number;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  precioListaRef: number;
  item: {
    type: 'PRODUCTO' | 'PRESENTACION';
    id: number;
    nombre: string;
    codigo?: string;
    descripcion?: string | null;
    imagenes: string[];
  };
};

type NormalizedCuota = {
  id: number;
  numero: number; // 0 si enganche
  fechaISO: string; // ISO
  monto: number;
  etiqueta: 'ENGANCHE' | 'NORMAL';
  origen: 'AUTO' | 'MANUAL';
  esManual: boolean;
  montoCapital: number | null;
  montoInteres: number | null;
};

export type NormalizedSolicitud = {
  id: number;
  estado: string;
  fechas: {
    solicitudISO: string;
    primeraCuotaISO: string | null;
  };
  economico: {
    totalPropuesto: number;
    cuotaInicialPropuesta: number | null;
    cuotasTotalesPropuestas: number;
    interesTipo: string;
    interesPorcentaje: number;
    planCuotaModo: string;
    diasEntrePagos: number;
  };
  sucursal: { id: number; nombre: string; direccion?: string | null };
  cliente: {
    id: number;
    nombre: string;
    apellidos?: string | null;
    telefono?: string | null;
    direccion?: string | null;
  };
  solicitadoPor: {
    id: number;
    nombre: string;
    correo?: string | null;
    rol?: string | null;
  };
  aprobadoPor?: {
    id: number;
    nombre: string;
    correo?: string | null;
    rol?: string | null;
  } | null;
  comentario?: string | null;

  lineas: NormalizedLinea[];

  schedule: {
    cuotas: NormalizedCuota[];
    sumaCuotas: number; // suma de todos los montos (enganche + normales)
    tieneEnganche: boolean;
    proximoVencimientoISO: string | null; // min(fecha) de cuotas NORMAL futuras/iguales a hoy
  };

  metrics: {
    items: number;
    subtotalLineas: number;
    tienePresentaciones: boolean;
  };
};

function firstUrls(arr?: { url: string }[]): string[] {
  if (!arr || !Array.isArray(arr)) return [];
  return arr.map((x) => x.url).filter(Boolean);
}

function normalizeLinea(
  l: SelectedCreditoAutorization['lineas'][number],
): NormalizedLinea {
  const isProducto = !!l.producto;
  const prod = l.producto;
  const pres = l.presentacion;

  const item = isProducto
    ? {
        type: 'PRODUCTO' as const,
        id: prod!.id,
        nombre: prod!.nombre,
        codigo: prod!.codigoProducto || undefined,
        descripcion: prod!.descripcion,
        imagenes: firstUrls(prod!.imagenesProducto),
      }
    : {
        type: 'PRESENTACION' as const,
        id: pres!.id,
        nombre: pres!.nombre,
        codigo: pres!.codigoBarras || undefined,
        descripcion: pres!.descripcion,
        imagenes: firstUrls(pres!.imagenesPresentacion),
      };

  return {
    id: l.id,
    cantidad: l.cantidad,
    precioUnitario: l.precioUnitario,
    subtotal: l.subtotal,
    precioListaRef: l.precioListaRef,
    item,
  };
}

function normalizeCuota(
  c: SelectedCreditoAutorization['cuotasPropuestas'][number],
): NormalizedCuota {
  const fecha = c.fecha as unknown as Date;
  const fechaISO =
    fecha && typeof (fecha as any).toISOString === 'function'
      ? fecha.toISOString()
      : (c as any).fecha; // por si viene como string

  return {
    id: c.id,
    numero: c.numero,
    fechaISO,
    monto: c.monto,
    etiqueta: c.etiqueta as 'ENGANCHE' | 'NORMAL',
    origen: c.origen as 'AUTO' | 'MANUAL',
    esManual: !!c.esManual,
    montoCapital: c.montoCapital ?? null,
    montoInteres: c.montoInteres ?? null,
  };
}
function r2(n: number) {
  return Math.round(n * 100) / 100;
}

export function normalizeSolicitud(
  rec: SelectedCreditoAutorization,
): NormalizedSolicitud {
  const lineas = (rec.lineas || []).map(normalizeLinea);
  const cuotas = (rec.cuotasPropuestas || []).map(normalizeCuota);
  const sumaCuotas = r2(cuotas.reduce((acc, q) => acc + (q.monto || 0), 0));
  const tieneEnganche = cuotas.some((q) => q.etiqueta === 'ENGANCHE');

  // próximo vencimiento: la menor fecha >= hoy de cuotas NORMAL
  const now = new Date();
  const proximas = cuotas
    .filter((q) => q.etiqueta === 'NORMAL')
    .map((q) => new Date(q.fechaISO))
    .filter((d) => !isNaN(d.getTime()) && d >= new Date(now.toDateString()))
    .sort((a, b) => a.getTime() - b.getTime());
  const proximoVencimientoISO = proximas[0]?.toISOString() ?? null;

  const metrics = {
    items: lineas.reduce((acc, ln) => acc + (ln.cantidad || 0), 0),
    subtotalLineas: lineas.reduce((acc, ln) => acc + (ln.subtotal || 0), 0),
    tienePresentaciones: lineas.some((l) => l.item.type === 'PRESENTACION'),
  };

  return {
    id: rec.id,
    estado: rec.estado,
    fechas: {
      solicitudISO:
        rec.fechaSolicitud?.toISOString?.() ?? (rec as any).fechaSolicitud,
      primeraCuotaISO: rec.fechaPrimeraCuota
        ? ((rec.fechaPrimeraCuota as Date).toISOString?.() ??
          (rec as any).fechaPrimeraCuota)
        : null,
    },
    economico: {
      totalPropuesto: rec.totalPropuesto,
      cuotaInicialPropuesta: rec.cuotaInicialPropuesta ?? null,
      cuotasTotalesPropuestas: rec.cuotasTotalesPropuestas,
      interesTipo: rec.interesTipo,
      interesPorcentaje: rec.interesPorcentaje,
      planCuotaModo: rec.planCuotaModo,
      diasEntrePagos: rec.diasEntrePagos,
    },
    sucursal: {
      id: rec.sucursal?.id!,
      nombre: rec.sucursal?.nombre!,
      direccion: rec.sucursal?.direccion ?? null,
    },
    cliente: {
      id: rec.cliente?.id!,
      nombre: rec.cliente?.nombre || '',
      apellidos: rec.cliente?.apellidos || null,
      telefono: rec.cliente?.telefono || null,
      direccion: rec.cliente?.direccion || null,
    },
    solicitadoPor: {
      id: rec.solicitadoPor?.id!,
      nombre: rec.solicitadoPor?.nombre || '',
      correo: rec.solicitadoPor?.correo || null,
      rol: rec.solicitadoPor?.rol || null,
    },
    aprobadoPor: rec.aprobadoPor
      ? {
          id: rec.aprobadoPor.id,
          nombre: rec.aprobadoPor.nombre || '',
          correo: rec.aprobadoPor.correo || null,
          rol: rec.aprobadoPor.rol || null,
        }
      : null,
    comentario: rec.comentario ?? null,

    lineas,
    schedule: {
      cuotas,
      sumaCuotas,
      tieneEnganche,
      proximoVencimientoISO,
    },

    metrics,
  };
}
