import { Prisma } from '@prisma/client';

export const SelectCreditosActivos = {
  id: true,
  interes: true,
  diasGracia: true,
  sucursalId: true,
  responsableCobroId: true,
  venta: {
    select: {
      solicitudCredito: {
        select: {
          solicitadoPor: {
            select: {
              id: true,
              nombre: true,
              rol: true,
              correo: true,
            },
          },
        },
      },
    },
  },
  cliente: {
    select: {
      id: true,
      nombre: true,
      apellidos: true,
      telefono: true,
    },
  },
  cuotas: {
    select: {
      id: true,
      numero: true,
      estado: true,
      monto: true,
      montoEsperado: true,
      moraAcumulada: true,
      fechaVencimiento: true,
      fechaPago: true,
      comentario: true,
      montoInteres: true,
      //.....
      fechaUltimoCalculoMora: true, // ✅ AÑADIDO
      montoPagado: true, // 👈 opcional pero útil
    },
    orderBy: {
      numero: 'asc',
    },
  },
} satisfies Prisma.VentaCuotaSelect;

export type CreditoActivoMorosoSelect = Prisma.VentaCuotaGetPayload<{
  select: typeof SelectCreditosActivos;
}>;
export type CreditoVentaCuotaSelect = CreditoActivoMorosoSelect;
