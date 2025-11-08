export type DtoGenProrrateo = {
  sucursalId: number;
  // Modo A (Recepción):
  compraRecepcionId?: number;
  // Modo B (Lotes nuevos):
  newStockIds?: number[]; // Stock.id (producto base)
  newStocksPresIds?: number[]; // StockPresentacion.id

  gastosAsociadosCompra: number; // G
  movimientoFinancieroId?: number; // idempotencia
  comentario?: string;

  // Opcionales de trazabilidad (recomendado pasarlos si los tienes)
  compraId?: number | null;
  entregaStockId?: number | null;
  //condicional
  aplicarProrrateo?: boolean;
};
