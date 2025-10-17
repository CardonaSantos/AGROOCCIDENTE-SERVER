import { Prisma, Venta } from '@prisma/client';

export const SelectTypeVentas = {
  id: true,
  clienteId: true,
  cliente: {
    select: {
      id: true,
      dpi: true,
      nombre: true,
      telefono: true,
      direccion: true,
      creadoEn: true,
      actualizadoEn: true,
      departamentoId: true,
      departamento: { select: { id: true, nombre: true } },
      municipio: { select: { id: true, nombre: true } },
    },
  },
  fechaVenta: true,
  horaVenta: true,
  productos: {
    select: {
      id: true,
      ventaId: true,
      productoId: true,
      cantidad: true,
      creadoEn: true,
      precioVenta: true,
      estado: true,
      producto: {
        select: {
          id: true,
          nombre: true,
          descripcion: true,
          codigoProducto: true,
          creadoEn: true,
          actualizadoEn: true,
        },
      },
      presentacion: {
        select: {
          id: true,
          nombre: true,
          descripcion: true,
          codigoBarras: true,
          creadoEn: true,
          actualizadoEn: true,
        },
      },
    },
  },
  totalVenta: true,
  metodoPago: {
    select: {
      id: true,
      ventaId: true,
      monto: true,
      metodoPago: true,
      fechaPago: true,
    },
  },
  nombreClienteFinal: true,
  telefonoClienteFinal: true,
  direccionClienteFinal: true,
  referenciaPago: true,
  tipoComprobante: true,
} satisfies Prisma.VentaSelect;

export type VentaSelectRow = Prisma.VentaGetPayload<{
  select: typeof SelectTypeVentas;
}>;
//EXPORTAR TYPE PARA USARLO EN NORMALIZADOR
export type VentaSelectArray = VentaSelectRow[];
