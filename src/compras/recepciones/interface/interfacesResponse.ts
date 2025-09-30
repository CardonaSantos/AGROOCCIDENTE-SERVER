// --- Enums/flags simples para el UI ---
export type ItemTipo = 'PRODUCTO' | 'PRESENTACION';

export interface UsuarioMinUI {
  id: number;
  nombre: string;
  correo: string;
  rol?: string | null;
}

export interface ItemMinUI {
  itemTipo: ItemTipo; // PRODUCTO | PRESENTACION
  itemId: number; // producto.id o presentacion.id
  productoId: number; // id del producto base (si es PRODUCTO, coincide)
  nombre: string;
  codigo?: string | null; // codigoProducto | codigoBarras
  imagenUrl?: string | null; // primera imagen del producto (si hay)
  categorias?: string[]; // nombres de categorías (si hay)
}

// --- Compra (cabecera + detalle con acumulados) ---
export interface CompraDetalleUI {
  detalleId: number;
  item: ItemMinUI;

  cantidadOrdenada: number;
  costoUnitario: number;

  recibidoAcumulado: number; // sum(cantidadRecibida en todas las recepciones para este detalle)
  pendiente: number; // cantidadOrdenada - recibidoAcumulado

  creadoEn: string; // ISO
  actualizadoEn: string; // ISO
}

export interface CompraResumenUI {
  id: number;
  fecha: string; // ISO (si no te sirve, puedes cambiar por Date)
  estado: string;
  origen: string;
  conFactura: boolean;
  total: number;
  usuario: UsuarioMinUI;
  // para dashboards/resúmenes
  totales: {
    lineasOrdenadas: number;
    unidadesOrdenadas: number;
    unidadesRecibidas: number;
    unidadesPendientes: number;
    recepcionesCount: number;
  };
  detalles: CompraDetalleUI[];
}

// --- Recepciones parciales (cada recepción con sus líneas normalizadas) ---
export interface RecepcionLineaUI {
  lineaId: number;
  compraDetalleId: number;

  item: ItemMinUI;

  cantidadRecibida: number;
  costoUnitario: number; // del detalle al que pertenece
  cantidadOrdenada: number;

  fechaExpiracion?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecepcionParcialUI {
  recepcionId: number;
  fecha: string; // ISO
  usuario: UsuarioMinUI;
  observaciones?: string | null;

  totales: {
    lineas: number;
    unidadesRecibidas: number;
  };

  lineas: RecepcionLineaUI[];
}

// --- Vista plana para tablas/exports ---
export interface RecepcionLineaFlatUI {
  recepcionId: number;
  recepcionFecha: string;

  lineaId: number;
  compraDetalleId: number;

  item: ItemMinUI;

  cantidadOrdenada: number;
  cantidadRecibida: number;
  costoUnitario: number;

  usuario: UsuarioMinUI;
  observaciones?: string | null;

  createdAt: string;
  updatedAt: string;
}

// --- Objeto raíz que devuelve el endpoint ---
export interface CompraRecepcionesParcialesUI {
  compra: CompraResumenUI;
  recepciones: RecepcionParcialUI[];
  lineasFlat: RecepcionLineaFlatUI[];
}
