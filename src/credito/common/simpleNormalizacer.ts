import { CreditoArrayResponse } from '../select/select-creditosResponse';

export function simpleCreditNormalizer(credits: CreditoArrayResponse) {
  return credits.map((c) => {
    const formattedCuotas = c.cuotas.map((cu) => ({
      id: cu.id,
      monto: cu.monto,
      fechaVencimiento: cu.fechaVencimiento,
      fechaPago: cu.fechaPago,
      numero: cu.numero,
      montoInteres: cu.montoInteres,
      estado: cu.estado,
    }));

    return {
      id: c.id,
      comentario: c.comentario,
      fechaInicio: c.fechaInicio,
      frecuenciaPago: c.frecuenciaPago,
      cliente: {
        id: c.cliente.id,
        nombre: `${c.cliente.nombre} ${c.cliente.apellidos ?? ''}`,
        telefono: c.cliente.telefono,
        direccion: c.cliente.direccion,
      },
      cuotas: formattedCuotas,
    };
  });
}
