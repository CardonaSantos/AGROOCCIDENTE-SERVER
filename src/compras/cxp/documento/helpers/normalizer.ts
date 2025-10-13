// src/credito/normalizers.ts
import { Prisma } from '@prisma/client';
import { CreditFromCompraTypes } from '../selects';

// ---------- UI types (frontend) ----------
export interface UICreditoCondicionPago {
  id: number;
  nombre: string | null;
  interes: number; // %
  diasCredito: number;
  diasEntreCuotas: number;
  tipoInteres: string | null; // ej: "NONE" | "SIMPLE" | "COMPUESTO"
  modoGeneracion: string | null;
  cantidadCuotas: number;
}

export interface UIMovimientoFinancieroMini {
  id: number;
  clasificacion: string | null;
  motivo: string | null;
  deltaBanco: number; // number
  deltaCaja: number; // number
  descripcion: string | null;
}

export interface UIPagoEnCuota {
  id: number; // id del pago
  fechaPagoISO: string; // ISO
  metodoPago: string | null; // "EFECTIVO" | "TRANSFERENCIA" | etc
  monto: number; // number
  observaciones: string | null;
  referencia: string | null;
  movimiento?: UIMovimientoFinancieroMini;
  registradoPor?: {
    id: number;
    nombre: string | null;
    correo: string | null;
    rol: string | null;
  };
}

export interface UICuota {
  id: number;
  numero: number;
  estado: string; // "PENDIENTE" | "PAGADA" | etc
  fechaVencimientoISO: string; // ISO
  pagadaEnISO: string | null; // ISO o null
  monto: number; // number
  saldo: number; // number (derivado si no existe)
  pagos: UIPagoEnCuota[]; // lista “plana” de pagos de esta cuota
}

export interface UICreditoCompra {
  id: number;
  folioProveedor: string | null;
  estado: string;
  fechaEmisionISO: string;
  fechaVencimientoISO: string | null;

  montoOriginal: number; // number
  interesTotal: number; // number

  condicionPago?: UICreditoCondicionPago;

  // Derivados
  totalCuotas: number;
  cuotasPagadas: number;
  cuotasPendientes: number;
  totalPagado: number; // sum pagos
  saldoPendiente: number; // sum saldos (o monto de no pagadas)

  cuotas: UICuota[];

  createdAtISO: string;
  updatedAtISO: string;
}

// ---------- Helpers robustos ----------
const D = Prisma.Decimal;

function toDec(v: unknown): Prisma.Decimal {
  if (v instanceof D) return v;
  if (typeof v === 'number' || typeof v === 'string') return new D(v);
  return new D(0);
}

function decToNumber(v: unknown, digits = 2): number {
  try {
    return toDec(v).toDecimalPlaces(digits).toNumber();
  } catch {
    return 0;
  }
}

function toISO(d: unknown): string | null {
  try {
    if (!d) return null;
    if (typeof d === 'string') return new Date(d).toISOString();
    if (d instanceof Date) return d.toISOString();
    return null;
  } catch {
    return null;
  }
}

function nonEmptyArray<T>(arr: T[] | null | undefined): T[] {
  return Array.isArray(arr) ? arr : [];
}

function truncate(s: string | null | undefined, max = 180): string | null {
  if (!s) return null;
  const str = String(s);
  return str.length > max ? `${str.slice(0, max)}…` : str;
}

function sortCuotas(
  a: { numero?: number; fechaVencimiento?: any },
  b: { numero?: number; fechaVencimiento?: any },
) {
  // ordena por numero, y si falta, por fecha
  const na = Number(a.numero ?? 0);
  const nb = Number(b.numero ?? 0);
  if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;

  const fa = new Date(a.fechaVencimiento as any).getTime() || 0;
  const fb = new Date(b.fechaVencimiento as any).getTime() || 0;
  return fa - fb;
}

// ---------- Normalizador principal ----------
export function normalizarCreditoFromCompra(
  credito: CreditFromCompraTypes,
): UICreditoCompra {
  const cuotasRaw = nonEmptyArray(credito.cuotas).slice().sort(sortCuotas);

  const cuotas: UICuota[] = cuotasRaw.map((c) => {
    const pagosRaw = nonEmptyArray(c.pagos);
    const pagos: UIPagoEnCuota[] = pagosRaw.map((pp) => {
      const p = pp.pago;
      return {
        id: p?.id ?? 0,
        fechaPagoISO:
          toISO(p?.fechaPago) ??
          toISO(p?.createdAt) ??
          new Date(0).toISOString(),
        metodoPago: p?.metodoPago ?? null,
        monto: decToNumber(p?.monto ?? pp.monto),
        observaciones: truncate(p?.observaciones, 240),
        referencia: truncate(p?.referencia, 120),
        movimiento: p?.movimientoFinanciero
          ? {
              id: p.movimientoFinanciero.id,
              clasificacion: p.movimientoFinanciero.clasificacion ?? null,
              motivo: p.movimientoFinanciero.motivo ?? null,
              deltaBanco: decToNumber(p.movimientoFinanciero.deltaBanco),
              deltaCaja: decToNumber(p.movimientoFinanciero.deltaCaja),
              descripcion: truncate(p.movimientoFinanciero.descripcion, 200),
            }
          : undefined,
        registradoPor: p?.registradoPor
          ? {
              id: p.registradoPor.id,
              nombre: p.registradoPor.nombre ?? null,
              correo: p.registradoPor.correo ?? null,
              rol: p.registradoPor.rol ?? null,
            }
          : undefined,
      };
    });

    // saldo de la cuota: si viene en DB lo usamos, si no lo construimos
    const montoCuota = decToNumber(c.monto);
    const saldoCuota =
      typeof c.saldo !== 'undefined' && c.saldo !== null
        ? decToNumber(c.saldo)
        : Math.max(
            0,
            montoCuota - pagos.reduce((acc, p) => acc + (p.monto || 0), 0),
          );

    return {
      id: c.id,
      numero: c.numero ?? 0,
      estado: c.estado ?? 'PENDIENTE',
      fechaVencimientoISO:
        toISO(c.fechaVencimiento) ?? new Date(0).toISOString(),
      pagadaEnISO: toISO(c.pagadaEn),
      monto: montoCuota,
      saldo: saldoCuota,
      pagos,
    };
  });

  // Derivados del crédito
  const totalCuotas = cuotas.length;
  const cuotasPagadas = cuotas.filter(
    (q) => q.estado === 'PAGADA' || q.saldo === 0,
  ).length;
  const cuotasPendientes = totalCuotas - cuotasPagadas;

  const totalPagado = cuotas.reduce(
    (acc, q) => acc + q.pagos.reduce((a, p) => a + (p.monto || 0), 0),
    0,
  );

  // Si tienes saldos por cuota, saldoPendiente = suma de saldos
  // Si no, fallback a: suma montos de cuotas con estado != PAGADA
  const saldoPendienteBySaldos = cuotas.reduce((acc, q) => acc + q.saldo, 0);
  const saldoPendienteFallback = cuotas
    .filter((q) => q.estado !== 'PAGADA')
    .reduce((acc, q) => acc + q.monto, 0);
  const saldoPendiente =
    Number.isFinite(saldoPendienteBySaldos) && saldoPendienteBySaldos > 0
      ? saldoPendienteBySaldos
      : saldoPendienteFallback;

  // Condición de pago (opcionales con null-safety)
  const cp = credito.condicionPago;
  const condicionPago = cp
    ? ({
        id: cp.id,
        nombre: cp.nombre ?? null,
        interes: decToNumber(cp.interes),
        diasCredito: Number(cp.diasCredito ?? 0),
        diasEntreCuotas: Number(cp.diasEntreCuotas ?? 0),
        tipoInteres: cp.tipoInteres ?? null,
        modoGeneracion: cp.modoGeneracion ?? null,
        cantidadCuotas: Number(cp.cantidadCuotas ?? totalCuotas),
      } as UICreditoCondicionPago)
    : undefined;

  const ui: UICreditoCompra = {
    id: credito.id,
    folioProveedor: credito.folioProveedor ?? null,
    estado: credito.estado ?? 'DESCONOCIDO',
    fechaEmisionISO: toISO(credito.fechaEmision) ?? new Date(0).toISOString(),
    fechaVencimientoISO: toISO(credito.fechaVencimiento),

    montoOriginal: decToNumber(credito.montoOriginal),
    interesTotal: decToNumber(credito.interesTotal),

    condicionPago,

    totalCuotas,
    cuotasPagadas,
    cuotasPendientes,
    totalPagado: decToNumber(totalPagado),
    saldoPendiente: decToNumber(saldoPendiente),

    cuotas,

    createdAtISO: toISO(credito.createdAt) ?? new Date(0).toISOString(),
    updatedAtISO: toISO(credito.updatedAt) ?? new Date(0).toISOString(),
  };

  return ui;
}
