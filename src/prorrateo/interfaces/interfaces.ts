// ======================================================
//  Cabecera (agregados a nivel de prorrateo / “pedido”)
// ======================================================
export type MappedCabecera = {
  /** = G en Excel (suma de gastos asociados del pedido) */
  gastosAsociadosPedido: number;
  /** = T en Excel (total nuevas unidades prorrateadas) */
  totalNuevas: number;
  /** = a = G/T (costo unitario del gasto asociado) */
  costoUnitarioDeGastoAsociado: number;
  /** Suma de los montos asignados por línea (control) */
  gastoAsignadoTotal: number;
  /** Suma de “Costo Prorrateado total inversión” de cada línea (control) */
  costoProrrateadoTotalInversion: number;
};

// ======================================================
//  Detalle (por lote/ítem) — columnas “estilo Excel”
// ======================================================
export type MappedDetalle = {
  detalleId: number;

  // Identificación producto/stock
  productoId: number;
  productoNombre: string | null;
  stockId: number;
  stockCreadoEn: Date | null;
  fechaIngreso: Date | null;
  fechaVencimiento: Date | null;

  // Cantidades
  /** stock.cantidad (existencia del lote luego de guardar) */
  cantidadStock: number;
  /** stock.cantidadInicial (si aplica) */
  cantidadInicialStock: number;
  /** “cantidad” usada para prorratear (UNIDADES nuevas de este lote) */
  cantidadBase: number;

  // Bases de prorrateo (compatibilidad; por UNIDADES dejamos valorBase=0)
  valorBase: number; // 0 en el método UNIDADES
  porcentajeParticipacion: number | null; // cantidadBase / totalNuevas

  // Costo factura y gastos
  /** cᵢ en Excel (costo unitario de factura) */
  costoFacturaUnitario: number | null;
  /** a = G/T (guardado por línea para auditoría) */
  gastoUnitarioBase: number | null;
  /** a_target (en UNIDADES es igual a a) */
  gastoUnitarioAplicado: number | null;

  // Resultados de costo unitario
  /** costo antes del prorrateo (snapshot) */
  precioCostoAntes: number | null;
  /** uᵢ calculado = cᵢ + a (o guardado) */
  costoUnitarioResultante: number | null;
  /** costo unitario que quedó guardado en el lote */
  precioCostoDesp: number | null;
  /** (precioCostoDesp||resultante) - antes */
  deltaUnitario: number | null;

  // Asignación de montos y verificación
  /** monto asignado a la línea (cantidadBase * a) */
  montoAsignado: number;
  /** (montoTotalCabecera * porcentajeParticipacion) */
  montoAsignadoEsperado: number | null;
  /** montoAsignado - montoAsignadoEsperado (control) */
  diffAsignacion: number | null;

  // Inversión/costos totales (línea)
  /** Lᵢ = cantidadBase * (cᵢ + a) */
  inversionLinea: number | null;
  /** stock.costoTotal guardado en BD */
  costoTotalStock: number | null;
  /** cantidadStock * (precioCostoDesp||resultante) */
  costoTotalRecalc: number | null;
  /** costoTotalStock - costoTotalRecalc (control) */
  diffCostoTotal: number | null;

  // ===== Snapshots “tipo Excel” por línea =====
  /** existencias previas del producto antes de esta compra */
  existenciasPrevias: number;
  /** inversión previa del producto (existPrev * costoPrevio) */
  inversionPrevias: number;
  /** existenciasPrevias + cantidadBase */
  nuevasExistencias: number;
  /** inversión previa + inversión de esta línea */
  costoProrrateadoTotalInversion: number;
  /** = costoProrrateadoTotalInversion / nuevasExistencias */
  costoUnitarioProrrateado: number;

  // Trazabilidad
  creadoEnDetalle: Date | null;

  // Aliases útiles para UI (mapeo directo Excel)
  /** alias de montoAsignado (lo conserva la UI) */
  gastoAsignado: number;
  /** alias de inversionLinea (lo conserva la UI) */
  totalInversion: number;
};

// ======================================================
//  Prorrateo (registro completo)
// ======================================================
export type MappedProrrateo = {
  prorrateoId: number;
  comentario: string | null;
  estado: string;
  metodo: string;
  /** montoTotal cabecera (G) */
  montoTotalCabecera: number;
  movimientoFinanciero: any; // según tu esquema
  entregaStock: { id: number | null; montoTotal: number | null };
  creadoEn: Date;

  // Cabecera “estilo Excel”
  cabecera: MappedCabecera;

  // Sumas de control (agregados del detalle)
  conteoLineas: number;
  sumas: {
    sumaCantidadBase: number;
    sumaValorBase: number; // quedará 0 en UNIDADES
    sumaMontoAsignado: number;
    sumaInversionLinea: number;
    sumaCostoTotalStock: number;
    sumaCostoTotalRecalc: number;
  };

  // Deltas/chequeos (consistencia)
  checks: {
    /** sumaMontoAsignado - montoTotalCabecera */
    diffMontoAsignadoVsCabecera: number;
    /** sumaInversionLinea - entrega.montoTotal (si existe) */
    diffInversionVsEntrega: number | null;
    /** sumaCostoTotalStock - sumaCostoTotalRecalc */
    diffStockGuardadoVsRecalc: number;
  };

  // Detalle expandido
  detalles: MappedDetalle[];
};
