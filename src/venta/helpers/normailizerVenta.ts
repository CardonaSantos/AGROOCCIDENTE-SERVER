// src/venta/normalizers/ventas.normalizer.ts
import { VentaSelectArray } from '../select/selecSalesType';

export type VentaRowUI = {
  id: number;
  fecha: string | Date;
  hora: string | Date;
  total: number;
  clienteNombre: string;
  clienteTelefono?: string | null;
  metodoPagoResumen: string;
  referenciaPago?: string | null;
  tipoComprobante?: string | null;
  itemsCount: number;
  items: Array<
    | {
        type: 'PRODUCTO';
        ventaProductoId: number;
        productoId: number;
        codigo: string | null;
        nombre: string;
        descripcion: string | null;
        cantidad: number;
        precioVenta: number;
      }
    | {
        type: 'PRESENTACION';
        ventaProductoId: number;
        presentacionId: number;
        codigo: string | null; // codigoBarras
        nombre: string;
        descripcion: string | null;
        cantidad: number;
        precioVenta: number;
      }
  >;
};

export const normalizerVentas = (ventas: VentaSelectArray): VentaRowUI[] => {
  return ventas.map((v) => {
    const clienteNombre =
      v.cliente?.nombre ?? v.nombreClienteFinal ?? 'SIN NOMBRE';
    const clienteTelefono =
      v.cliente?.telefono ?? v.telefonoClienteFinal ?? null;

    // método de pago → resumen legible
    const metodoPagoResumen = Array.isArray(v.metodoPago)
      ? v.metodoPago.map((m) => `${m.metodoPago}: ${m.monto}`).join(', ')
      : '';

    const items =
      Array.isArray(v.productos) && v.productos.length
        ? v.productos.map((p) => {
            if (p.presentacion) {
              return {
                type: 'PRESENTACION' as const,
                ventaProductoId: p.id,
                presentacionId: p.presentacion.id,
                codigo: p.presentacion.codigoBarras ?? null,
                nombre: p.presentacion.nombre,
                descripcion: p.presentacion.descripcion,
                cantidad: p.cantidad,
                precioVenta: p.precioVenta,
              };
            }
            // fallback a producto
            return {
              type: 'PRODUCTO' as const,
              ventaProductoId: p.id,
              productoId: p.producto.id,
              codigo: p.producto.codigoProducto ?? null,
              nombre: p.producto.nombre,
              descripcion: p.producto.descripcion,
              cantidad: p.cantidad,
              precioVenta: p.precioVenta,
            };
          })
        : [];

    const itemsCount = items.reduce((acc, it) => acc + (it.cantidad ?? 0), 0);

    return {
      id: v.id,
      fecha: v.fechaVenta,
      hora: v.horaVenta,
      total: v.totalVenta,
      clienteNombre,
      clienteTelefono,
      metodoPagoResumen,
      metodoPago: v.metodoPago.metodoPago,

      referenciaPago: v.referenciaPago,
      tipoComprobante: v.tipoComprobante,
      itemsCount,
      items,
    };
  });
};
