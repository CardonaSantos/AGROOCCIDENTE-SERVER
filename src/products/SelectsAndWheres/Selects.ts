import { Prisma } from '@prisma/client';

export const productoSelect: Prisma.ProductoSelect = {
  id: true,
  nombre: true,
  codigoProducto: true,
  descripcion: true,
  precios: {
    select: {
      id: true,
      estado: true,
      precio: true,
      rol: true,
      tipo: true,
      orden: true,
    },
  },
  stock: {
    select: {
      id: true,
      cantidad: true,
      fechaVencimiento: true,
      fechaIngreso: true,
      sucursal: {
        select: {
          id: true,
          nombre: true,
        },
      },
    },
  },
  stockThreshold: {
    select: {
      id: true,
      stockMinimo: true,
    },
  },
  categorias: {
    select: {
      id: true,
      nombre: true,
    },
  },
};

export const presentacionSelect: Prisma.ProductoPresentacionSelect = {
  id: true,
  nombre: true,
  codigoBarras: true,
  tipoPresentacion: true,
  creadoEn: true,
  actualizadoEn: true,
  esDefault: true,
  precios: {
    select: {
      id: true,
      estado: true,
      orden: true,
      precio: true,
      rol: true,
      tipo: true,
    },
  },
  //   descripcion: true,
  stockPresentaciones: {
    select: {
      id: true,
      cantidadPresentacion: true,
      fechaVencimiento: true,
      fechaIngreso: true,
      sucursal: {
        select: {
          id: true,
          nombre: true,
        },
      },
    },
  },
  //   stockThreshold: {
  //     select: {
  //       id: true,
  //       stockMinimo: true,
  //     },
  //   },
};
