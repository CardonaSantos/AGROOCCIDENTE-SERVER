export type CustomersToCredit = {
  id: number;
  nombre: string;
  telefono: string;
  dpi: string;
};
export type PrecioApi = { id: number; precio: string; rol: string };
export type PresentacionApi = {
  id: number;
  nombre: string;
  // sku?: string | null;
  codigoBarras?: string | null;
  tipoPresentacion: string;
  precios: PrecioApi[];
  stockPresentaciones: { id: number; cantidad?: number | null }[];
};
export type ProductoApi = {
  id: number;
  nombre: string;
  descripcion?: string | null;
  codigoProducto: string;
  precios: PrecioApi[];
  stock: { id: number; cantidad?: number | null }[];
  imagenesProducto?: { id: number; url: string }[];
  presentaciones: PresentacionApi[];
};
