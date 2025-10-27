export type RequisitionProductCandidate = {
  productoId: number;
  nombre: string;
  codigoProducto: string | null;
  unidadBase: string;
  precioCostoProducto: number | null;

  stockBase: number;
  stockPresentacionesEq: string; // Decimal string
  stockTotalEq: string; // Decimal string
  stockMinimo: number;
  belowThreshold: boolean;
  faltanteSugerido: number;

  pendientesProductoFolios: string[];

  presentaciones: Array<{
    id: number;
    nombre: string;
    // tipoPresentacion: TipoEmpaque;
    factorUnidadBase: string; // Decimal string
    costoReferencialPresentacion: string | null;
    sku: string | null;
    codigoBarras: string | null;
    esDefault: boolean;
    activo: boolean;

    stockCantidadPresentacion: number;
    stockEquivalenteBase: string; // Decimal string
    pendientesFolios: string[];
  }>;
};

export type PagedResponse<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type GetV2Args = {
  sucursalId: number;
  page: number;
  pageSize: number;
  q?: string;
  sortBy?:
    | 'priority'
    | 'nombre'
    | 'codigoProducto'
    | 'stockTotalEq'
    | 'stockMinimo'
    | 'faltanteSugerido';
  sortDir?: 'asc' | 'desc';
};
