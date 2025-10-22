// select/select-creditosResponse.ts
import { Prisma } from '@prisma/client';

export const SelectCreditos = {
  // Campos base del crédito
  id: true,
  clienteId: true,
  usuarioId: true,
  sucursalId: true,
  totalVenta: true,
  cuotaInicial: true,
  cuotasTotales: true,
  fechaInicio: true,
  estado: true,
  creadoEn: true,
  actualizadoEn: true,
  dpi: true,
  testigos: true,
  fechaContrato: true,
  montoVenta: true,
  garantiaMeses: true,
  totalPagado: true,
  diasEntrePagos: true,
  interes: true,
  comentario: true,
  ventaId: true,
  montoTotalConInteres: true,
  frecuenciaPago: true,
  planCuotaModo: true,
  interesTipo: true,
  diasGracia: true,
  moraDiaria: true,
  fechaProximoPago: true,
  numeroCredito: true,

  // Relaciones clave
  cliente: {
    select: {
      id: true,
      nombre: true,
      apellidos: true,
      telefono: true,
      direccion: true,
      dpi: true,
    },
  },
  usuario: {
    select: {
      id: true,
      nombre: true,
      rol: true,
      sucursalId: true,
    },
  },
  sucursal: {
    select: {
      id: true,
      nombre: true,
      tipoSucursal: true,
    },
  },

  // Venta y sus detalles (incluye solicitud origen)
  venta: {
    select: {
      id: true,
      fechaVenta: true,
      totalVenta: true,
      referenciaPago: true,
      tipoComprobante: true,
      imei: true,
      usuario: { select: { id: true, nombre: true } },
      metodoPago: {
        select: { id: true, metodoPago: true, monto: true, fechaPago: true },
      },
      productos: {
        select: {
          id: true,
          cantidad: true,
          precioVenta: true,
          producto: {
            select: {
              id: true,
              nombre: true,
              codigoProducto: true,
              imagenesProducto: { select: { url: true }, take: 3 },
            },
          },
          presentacion: {
            select: {
              id: true,
              nombre: true,
              codigoBarras: true,
              producto: { select: { id: true } },
            },
          },
        },
      },
      solicitudCredito: {
        select: {
          id: true,
          estado: true, // enum EstadoSolicitud
          fechaSolicitud: true,
          fechaRespuesta: true,
          solicitadoPor: { select: { id: true, nombre: true } },
          aprobadoPor: { select: { id: true, nombre: true } },
          lineas: {
            select: {
              id: true,
              cantidad: true,
              precioUnitario: true,
              precioListaRef: true,
              subtotal: true,
              producto: {
                select: { id: true, nombre: true, codigoProducto: true },
              },
              presentacion: {
                select: { id: true, nombre: true, codigoBarras: true },
              },
              nombreProductoSnapshot: true,
              presentacionNombreSnapshot: true,
              codigoBarrasSnapshot: true,
            },
          },
          historial: {
            select: {
              id: true,
              accion: true,
              comentario: true,
              fecha: true,
              actor: { select: { id: true, nombre: true } },
            },
            take: 20,
            orderBy: { fecha: 'desc' },
          },
        },
      },
    },
  },

  // Cuotas (con resumen)
  cuotas: {
    select: {
      id: true,
      numero: true,
      monto: true,
      montoEsperado: true,
      montoCapital: true,
      montoInteres: true,
      montoPagado: true,
      saldoPendiente: true,
      moraAcumulada: true,
      fechaVencimiento: true,
      fechaPago: true,
      estado: true,
      creadoEn: true,
      actualizadoEn: true,
      abonos: {
        select: {
          id: true,
          montoCapital: true,
          montoInteres: true,
          montoMora: true,
          montoTotal: true,
          abono: {
            select: {
              id: true,
              fechaAbono: true,
              metodoPago: true,
              referenciaPago: true,
              usuario: { select: { id: true, nombre: true } },
            },
          },
        },
        take: 20,
        orderBy: { id: 'asc' },
      },
    },
    orderBy: { numero: 'asc' },
    take: 60, // defensa ante créditos largos
  },

  // Abonos al crédito (cabecera + desglose)
  abonos: {
    select: {
      id: true,
      fechaAbono: true,
      metodoPago: true,
      referenciaPago: true,
      montoTotal: true,
      usuario: { select: { id: true, nombre: true } },
      sucursal: { select: { id: true, nombre: true } },
      detalles: {
        select: {
          id: true,
          cuotaId: true,
          montoCapital: true,
          montoInteres: true,
          montoMora: true,
          montoTotal: true,
        },
      },
    },
    orderBy: { fechaAbono: 'desc' },
    take: 50,
  },

  // Historial de acciones del crédito
  historial: {
    select: {
      id: true,
      accion: true,
      comentario: true,
      fecha: true,
      usuario: { select: { id: true, nombre: true } },
    },
    orderBy: { fecha: 'desc' },
    take: 50,
  },
} satisfies Prisma.VentaCuotaSelect;

export type CreditoSelect = Prisma.VentaCuotaGetPayload<{
  select: typeof SelectCreditos;
}>;

export type CreditoArrayResponse = CreditoSelect[];
