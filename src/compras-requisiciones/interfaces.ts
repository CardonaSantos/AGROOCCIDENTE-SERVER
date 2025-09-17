// Tipos locales para los DTOs de stock
export type StockBaseDto = {
  productoId: number;
  cantidad: number; // = CompraDetalle.cantidad (sin factor)
  costoTotal: number; // = costoUnitario * cantidad
  fechaIngreso: string;
  fechaExpiracion: Date | null;
  precioCosto: number; // = costoUnitario
  sucursalId: number;
  requisicionRecepcionId?: number;
};

export type StockPresentacionDto = {
  productoId: number;
  presentacionId: number;
  sucursalId: number;
  cantidadPresentacion: number; // = CompraDetalle.cantidad
  fechaIngreso: Date;
  fechaVencimiento?: Date | null;
  requisicionRecepcionId: number | null;
};
