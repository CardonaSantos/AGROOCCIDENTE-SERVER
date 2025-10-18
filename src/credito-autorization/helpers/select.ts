import { Prisma, SolicitudCreditoVenta } from '@prisma/client';

export const selectCreditAutorization = {
  id: true,
  creadoEn: true,
  actualizadoEn: true,
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
  sucursal: {
    select: {
      id: true,
      nombre: true,
      direccion: true,
    },
  },
  cliente: {
    select: {
      id: true,
      nombre: true,
      apellidos: true,
      telefono: true,
      direccion: true,
    },
  },
  aprobadoPor: {
    select: {
      id: true,
      nombre: true,
      correo: true,
      rol: true,
    },
  },
  solicitadoPor: {
    select: {
      id: true,
      nombre: true,
      correo: true,
      rol: true,
    },
  },
  lineas: {
    select: {
      id: true,
      cantidad: true,
      precioUnitario: true,
      subtotal: true,
      precioListaRef: true,
      producto: {
        select: {
          id: true,
          nombre: true,
          codigoProducto: true,
          descripcion: true,
          imagenesProducto: {
            select: {
              id: true,
              url: true,
            },
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
            select: {
              id: true,
              url: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.SolicitudCreditoVentaSelect;

export type SelectedCreditoAutorization =
  Prisma.SolicitudCreditoVentaGetPayload<{
    select: typeof selectCreditAutorization;
  }>;

export type CreditoAutorizacion = SelectedCreditoAutorization[];
