import { Prisma } from '@prisma/client';

export const productoSelect = {
  id: true,
  nombre: true,
  codigoProducto: true,
  descripcion: true,
  precioCostoActual: true,
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
      sucursal: { select: { id: true, nombre: true } },
    },
  },
  stockThreshold: { select: { id: true, stockMinimo: true } },
  categorias: { select: { id: true, nombre: true } },
  imagenesProducto: {
    select: {
      url: true,
    },
  },
} satisfies Prisma.ProductoSelect;

export const presentacionSelect = {
  id: true,
  nombre: true,
  codigoBarras: true,
  tipoPresentacion: true,
  creadoEn: true,
  actualizadoEn: true,
  esDefault: true,
  costoReferencialPresentacion: true,
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
  producto: {
    select: {
      imagenesProducto: {
        select: {
          url: true,
        },
      },
    },
  },
} satisfies Prisma.ProductoPresentacionSelect; //AJUSTAR LA FLAG: los selects internos se tipean

// TYPES BASADOS EN SELECTS
export type ProductoWithSelect = Prisma.ProductoGetPayload<{
  select: typeof productoSelect;
}>;

export type PresentacionWithSelect = Prisma.ProductoPresentacionGetPayload<{
  select: typeof presentacionSelect;
}>;
