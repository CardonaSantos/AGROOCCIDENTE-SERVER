// selects/credit-authorization.select.ts
import { Prisma } from '@prisma/client';

export const selectCreditAutorization = {
  id: true,
  sucursalId: true,
  clienteId: true,
  comentario: true,
  cuotaInicialPropuesta: true,
  cuotasTotalesPropuestas: true,
  diasEntrePagos: true,
  estado: true,
  fechaSolicitud: true,
  interesTipo: true,
  interesPorcentaje: true,
  totalPropuesto: true,
  planCuotaModo: true,
  fechaPrimeraCuota: true,
  creadoEn: true,
  actualizadoEn: true,

  solicitadoPor: {
    select: { id: true, nombre: true, correo: true, rol: true },
  },
  aprobadoPor: { select: { id: true, nombre: true, correo: true, rol: true } },
  sucursal: { select: { id: true, nombre: true, direccion: true } },
  cliente: {
    select: {
      id: true,
      nombre: true,
      apellidos: true,
      telefono: true,
      direccion: true,
    },
  },

  lineas: {
    select: {
      id: true,
      cantidad: true,
      precioUnitario: true,
      subtotal: true,
      precioListaRef: true,
      //nuevos
      precioSeleccionado: true,
      precioSeleccionadoId: true,
      productoId: true,
      presentacionId: true,

      producto: {
        select: {
          id: true,
          nombre: true,
          codigoProducto: true,
          descripcion: true,
          imagenesProducto: {
            select: { id: true, url: true },
            orderBy: { id: 'asc' },
            take: 1,
          },
        },
      },
      presentacion: {
        select: {
          id: true,
          nombre: true,
          codigoBarras: true,
          descripcion: true,
          imagenesPresentacion: {
            select: { id: true, url: true },
            orderBy: { id: 'asc' },
            take: 1,
          },
        },
      },
    },
  },

  // ===== NUEVO: calendario propuesto persistido
  cuotasPropuestas: {
    select: {
      id: true,
      numero: true,
      fecha: true,
      monto: true,
      etiqueta: true, // 'ENGANCHE' | 'NORMAL'
      origen: true, // 'AUTO' | 'MANUAL'
      esManual: true,
      montoCapital: true,
      montoInteres: true,
    },
    orderBy: { numero: 'asc' },
  },
} satisfies Prisma.SolicitudCreditoVentaSelect;

export type SelectedCreditoAutorization =
  Prisma.SolicitudCreditoVentaGetPayload<{
    select: typeof selectCreditAutorization;
  }>;

export type CreditoAutorizacion = SelectedCreditoAutorization[];
