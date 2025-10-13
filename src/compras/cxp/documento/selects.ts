import { Prisma } from '@prisma/client';
import { TransferenciaProductoService } from 'src/transferencia-producto/transferencia-producto.service';

export const selectCreditoFromCompra = {
  id: true,
  folioProveedor: true,
  estado: true,
  fechaEmision: true,
  fechaVencimiento: true,
  montoOriginal: true,
  interesTotal: true,

  condicionPago: {
    select: {
      id: true,
      cantidadCuotas: true,
      createdAt: true,
      updatedAt: true,
      nombre: true,
      interes: true,
      diasCredito: true,
      modoGeneracion: true,
      tipoInteres: true,
      diasEntreCuotas: true,
    },
  },

  cuotas: {
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      estado: true,
      monto: true,
      numero: true,
      pagadaEn: true,
      saldo: true,
      fechaVencimiento: true,
      pagos: {
        select: {
          monto: true,
          pago: {
            select: {
              id: true,
              createdAt: true,
              fechaPago: true,
              monto: true,
              metodoPago: true,
              observaciones: true,
              referencia: true,
              updatedAt: true,
              movimientoFinanciero: {
                select: {
                  id: true,
                  clasificacion: true,
                  motivo: true,
                  deltaBanco: true,
                  deltaCaja: true,
                  descripcion: true,
                },
              },
              registradoPor: {
                select: {
                  id: true,
                  nombre: true,
                  correo: true,
                  rol: true,
                },
              },
            },
          },
        },
      },
    },
  },

  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CxPDocumentoSelect;

export type CreditFromCompraTypes = Prisma.CxPDocumentoGetPayload<{
  select: typeof selectCreditoFromCompra;
}>;
