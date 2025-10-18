import { CreditoAutorizacion } from '../helpers/select';

export const normalizerCreditoAutorizations = (
  autorizations: CreditoAutorizacion,
) => {
  return autorizations.map((auth) => {
    const lineasFormatt = auth.lineas.map((l) => {
      const isPresentations: boolean = l.presentacion ? true : false;
      if (isPresentations) {
        return {
          id: l.id,
          cantidad: l.cantidad,
          precioListaRef: l.precioListaRef,
          precioUnitario: l.precioUnitario,
          presentacion: l.presentacion,
          subtotal: l.subtotal,
          flagItem: 'PRESENTACION',
          producto: {
            id: l.presentacion.id,
            nombre: l.presentacion.nombre,
            descripcion: l.presentacion.descripcion,
            codigoProducto: l.presentacion.codigoBarras,
            imagenesProducto: l.presentacion.imagenesPresentacion,
            imagenProducto: l.presentacion.imagenesPresentacion[0].url,
          },
        };
      } else {
        return {
          id: l.id,
          cantidad: l.cantidad,
          precioListaRef: l.precioListaRef,
          precioUnitario: l.precioUnitario,
          presentacion: l.presentacion,
          subtotal: l.subtotal,
          flagItem: 'PRODUCTO',
          producto: {
            id: l.producto.id,
            nombre: l.producto.nombre,
            descripcion: l.producto.descripcion,
            codigoProducto: l.producto.codigoProducto,
            imagenesProducto: l.producto.imagenesProducto,
            imagenProducto: l.producto.imagenesProducto[0].url,
          },
        };
      }
    });

    return {
      id: auth.id,
      creadoEn: auth.creadoEn,
      actualizadoEn: auth.actualizadoEn,
      comentario: auth.comentario,
      cuotaInicialPropuesta: auth.cuotaInicialPropuesta,
      cuotasTotalesPropuestas: auth.cuotasTotalesPropuestas,
      diasEntrePagos: auth.diasEntrePagos,
      estado: auth.estado,
      fechaPrimeraCuota: auth.fechaPrimeraCuota,
      fechaSolicitud: auth.fechaSolicitud,
      interesPorcentaje: auth.interesPorcentaje,
      interesTipo: auth.interesTipo,
      planCuotaModo: auth.planCuotaModo,
      totalPropuesto: auth.totalPropuesto,
      lineas: lineasFormatt,
      sucursal: {
        id: auth.sucursal.id,
        direccion: auth.sucursal.direccion,
        nombre: auth.sucursal.nombre,
      },

      cliente: {
        id: auth.cliente.id,
        nombre: auth.cliente.nombre,
        apellidos: auth.cliente.apellidos,
        telefono: auth.cliente.telefono,
      },
      aprobadoPor: {
        id: auth.aprobadoPor.id,
        nombre: auth.aprobadoPor.nombre,
        correo: auth.aprobadoPor.correo,
        rol: auth.aprobadoPor.rol,
      },
      solicitadoPor: {
        id: auth.solicitadoPor.id,
        nombre: auth.solicitadoPor.nombre,
        correo: auth.solicitadoPor.correo,
        rol: auth.solicitadoPor.correo,
      },
    };
  });
};
