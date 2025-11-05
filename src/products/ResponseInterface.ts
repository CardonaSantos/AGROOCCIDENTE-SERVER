import { RolPrecio, TipoPrecio } from '@prisma/client';

export interface ProductoInventarioResponse {
  id: number;
  nombre: string;
  precioCosto: string;
  codigoProducto: string;
  descripcion: string;
  // tipoPresentacion?: TipoEmpaque;
  precios: PrecioProductoNormalized[];
  stocks: StocksProducto[];
  stocksBySucursal: StocksBySucursal;
}

export interface PrecioProductoNormalized {
  id: number;
  precio: string;
  rol: RolPrecio;
  tipo: TipoPrecio;
  orden: number;
}
export type StocksBySucursal = StockPorSucursal[];
export interface ProrrateoLite {
  sumaAsignado: number; // total prorrateado al lote
  ultimaFecha: string | null; // ISO
  ultimaProrrateoId: number | null; // para drill-down si hace falta
}

export interface StockPorSucursal {
  sucursalId: number;
  nombre: string;
  cantidad: number;
}

export interface StocksProducto {
  id: number;
  cantidad: number;
  fechaIngreso: string;
  fechaVencimiento: string;
  prorrateo?: ProrrateoLite; // 👈 nuevo (opcional)
}
