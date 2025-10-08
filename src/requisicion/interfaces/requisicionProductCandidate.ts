import { TipoEmpaque } from '@prisma/client';

// requisicion.types.ts
export type RequisitionProductCandidate = {
  // Producto
  productoId: number;
  nombre: string;
  codigoProducto: string | null;
  unidadBase: string; // "ml", "g", "unidades", etc.
  precioCostoProducto: number | null; // tu Float? actual

  // Stock y umbral a nivel PRODUCTO (en unidades base)
  stockBase: number; // suma Stock.cantidad (sucursal)
  stockPresentacionesEq: string; // Decimal string (equivalente en unidades base)
  stockTotalEq: string; // Decimal string (base + presentaciones)
  stockMinimo: number; // si no hay threshold => 0
  belowThreshold: boolean;
  faltanteSugerido: number; // entero; si belowThreshold => al menos 1
  // Requisiciones pendientes a nivel producto
  pendientesProductoFolios: string[];

  // Presentaciones del producto
  presentaciones: Array<{
    id: number;
    nombre: string;
    tipoPresentacion: TipoEmpaque;
    // factorUnidadBase: string; // Decimal string
    costoReferencialPresentacion: string | null; // Decimal string
    // sku: string | null;
    codigoBarras: string | null;
    esDefault: boolean;
    activo: boolean;

    // Stock de esta presentación en la sucursal:
    stockCantidadPresentacion: number; // suma StockPresentacion.cantidadPresentacion
    stockEquivalenteBase: string; // cantidadPresentacion * factorUnidadBase (Decimal string)

    // Requisiciones pendientes a nivel presentación
    pendientesFolios: string[];
  }>;
};
