import { RolPrecio } from '@prisma/client';

export interface PrecioPorRolRaw {
  rol: RolPrecio;
  precio: string | number;
}

export interface ProductoRaw {
  codigoproducto: string | null;
  nombre: string | null;
  descripcion: string | null;
  codigoproveedor: string | null;
  categorias: string[];
  tipoempaque: string | null;

  stockminimo: number | null;
  stockvencimiento: number | string | null;
  stockactual: number | string | null;

  preciocosto: string | number;

  precios: PrecioPorRolRaw[];
}
