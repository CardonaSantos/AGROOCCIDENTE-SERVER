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

export interface StockPorSucursal {
  sucursalId: number;
  nombre: string;
  cantidad: number;
}

export interface prorrateoInfo {
  id: number;
  costoFacturaUnitario: number;
  costoProrrateadoTotalInversion: number;
  costoUnitarioProrrateado: number;
  costoUnitarioResultante: number;
  creadoEn: Date;
  existenciasPrevias: number;
  gastoUnitarioAplicado: number;
  gastoUnitarioBase: number;
  inversionLinea: number;
  inversionPrevias: number;
  nuevasExistencias: number;
}
[];

export interface StocksProducto {
  id: number;
  cantidad: number;
  fechaIngreso: string;
  fechaVencimiento: string;
  prorrateo?: prorrateoInfo[];
}
