export interface ProductoRaw {
  codigoproducto: string | null;
  nombre: string | null;
  descripcion: string | null;
  codigoproveedor: string | null;
  categorias: string | null;
  tipoempaque: string | null;
  stockminimo: number | null;
  stockvencimiento: number | string | null;
  precios: string[];
  preciocosto: string | number;
}

export type ProductosArrayRaw = ProductoRaw[];
