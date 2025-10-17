// src/venta/normalizers/venta-pdf.normalizer.ts
// Tipos del PDF que ya usa el front:
export interface MetodoPago {
  id: number;
  ventaId: number;
  monto: number;
  metodoPago: string;
  fechaPago: string;
}

export interface Sucursal {
  nombre: string;
  direccion: string;
  id: number;
  pbx: number;
  telefono: number;
}

export interface Cliente {
  nombre: string;
  apellidos: string;
  correo: string;
  telefono: string;
  direccion: string;
  dpi: string;
}

export interface ProductoInfo {
  id: number;
  nombre: string;
  descripcion: string;
  codigoProducto: string; // Para presentación pondremos el código de barras aquí
  creadoEn: string;
  actualizadoEn: string;
}

export interface ProductoVenta {
  id: number;
  ventaId: number;
  productoId: number; // Para presentación usaremos el id de la presentación
  cantidad: number;
  creadoEn: string;
  precioVenta: number;
  producto: ProductoInfo;
  descripcion: string;
}

export interface VentaHistorialPDF {
  id: number;
  clienteId: number | null;
  fechaVenta: string;
  horaVenta: string;
  totalVenta: number;
  cliente: Cliente | null;
  metodoPago: MetodoPago;
  productos: ProductoVenta[];
  sucursal: Sucursal;
  // campos “cliente final”
  nombreClienteFinal: string | null;
  telefonoClienteFinal: string | null;
  direccionClienteFinal: string | null;
  imei: string | null;
}

// Helpers seguros
const toISO = (d: any) =>
  d instanceof Date ? d.toISOString() : typeof d === 'string' ? d : null;

const safeStr = (v: any, fallback = '') => (v == null ? fallback : String(v));

// Si metodoPago viene como array → compactamos a un solo objeto
const normalizeMetodoPago = (
  mp: any,
  v: { id: number; fechaVenta: any; totalVenta: number },
): MetodoPago => {
  const fecha = toISO(v.fechaVenta) ?? new Date().toISOString();

  if (!mp) {
    return {
      id: 0,
      ventaId: v.id,
      monto: v.totalVenta,
      metodoPago: 'CONTADO',
      fechaPago: fecha,
    };
  }

  if (Array.isArray(mp)) {
    if (mp.length === 1) {
      const m = mp[0];
      return {
        id: m.id ?? 0,
        ventaId: m.ventaId ?? v.id,
        monto: Number(m.monto ?? v.totalVenta),
        metodoPago: safeStr(m.metodoPago, 'CONTADO'),
        fechaPago: toISO(m.fechaPago) ?? fecha,
      };
    }
    const montoSum = mp.reduce((acc, it) => acc + Number(it?.monto ?? 0), 0);
    const last = mp[mp.length - 1];
    return {
      id: last?.id ?? 0,
      ventaId: v.id,
      monto: Number.isFinite(montoSum) ? montoSum : v.totalVenta,
      metodoPago: 'MIXTO',
      fechaPago: toISO(last?.fechaPago) ?? fecha,
    };
  }

  // Objeto simple
  return {
    id: mp.id ?? 0,
    ventaId: mp.ventaId ?? v.id,
    monto: Number(mp.monto ?? v.totalVenta),
    metodoPago: safeStr(mp.metodoPago, 'CONTADO'),
    fechaPago: toISO(mp.fechaPago) ?? fecha,
  };
};

// Normalizador principal
export const normalizeVentaForPDF = (v: any): VentaHistorialPDF => {
  const productos: ProductoVenta[] = (v.productos ?? []).map((line: any) => {
    // priorizar presentacion si existe
    if (line.presentacion) {
      const pr = line.presentacion;
      const info: ProductoInfo = {
        id: pr.id,
        nombre: safeStr(pr.nombre),
        descripcion: safeStr(pr.descripcion),
        codigoProducto: safeStr(pr.codigoBarras), // 👈 barcode va aquí
        creadoEn: toISO(pr.creadoEn) ?? '',
        actualizadoEn: toISO(pr.actualizadoEn) ?? '',
      };
      return {
        id: line.id,
        ventaId: v.id,
        productoId: pr.id, // usamos id de presentación
        cantidad: line.cantidad,
        creadoEn: toISO(line.creadoEn) ?? '',
        precioVenta: line.precioVenta,
        producto: info,
        descripcion: info.descripcion,
      };
    }
    // fallback a producto
    const p = line.producto;
    const info: ProductoInfo = {
      id: p.id,
      nombre: safeStr(p.nombre),
      descripcion: safeStr(p.descripcion),
      codigoProducto: safeStr(p.codigoProducto),
      creadoEn: toISO(p.creadoEn) ?? '',
      actualizadoEn: toISO(p.actualizadoEn) ?? '',
    };
    return {
      id: line.id,
      ventaId: v.id,
      productoId: p.id,
      cantidad: line.cantidad,
      creadoEn: toISO(line.creadoEn) ?? '',
      precioVenta: line.precioVenta,
      producto: info,
      descripcion: info.descripcion,
    };
  });

  return {
    id: v.id,
    clienteId: v.clienteId ?? null,
    fechaVenta: toISO(v.fechaVenta) ?? '',
    horaVenta: toISO(v.horaVenta) ?? '',
    totalVenta: v.totalVenta,
    cliente: v.cliente
      ? {
          nombre: safeStr(v.cliente.nombre),
          apellidos: safeStr(v.cliente.apellidos),
          correo: safeStr(v.cliente.correo),
          telefono: safeStr(v.cliente.telefono),
          direccion: safeStr(v.cliente.direccion),
          dpi: safeStr(v.cliente.dpi),
        }
      : null,
    metodoPago: normalizeMetodoPago(v.metodoPago, v),
    productos,
    sucursal: {
      nombre: safeStr(v.sucursal?.nombre),
      direccion: safeStr(v.sucursal?.direccion),
      id: v.sucursal?.id ?? 0,
      pbx: Number(v.sucursal?.pbx ?? 0),
      telefono: Number(v.sucursal?.telefono ?? 0),
    },
    nombreClienteFinal: v.nombreClienteFinal ?? null,
    telefonoClienteFinal: v.telefonoClienteFinal ?? null,
    direccionClienteFinal: v.direccionClienteFinal ?? null,
    imei: v.imei ?? null,
  };
};
