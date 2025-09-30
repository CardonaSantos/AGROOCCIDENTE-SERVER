-- CreateEnum
CREATE TYPE "CxPEstado" AS ENUM ('PENDIENTE', 'PARCIAL', 'PAGADO', 'ANULADO');

-- CreateEnum
CREATE TYPE "CuotaEstado" AS ENUM ('PENDIENTE', 'PARCIAL', 'PAGADA', 'VENCIDA');

-- CreateEnum
CREATE TYPE "InteresTipo" AS ENUM ('NONE', 'SIMPLE', 'COMPUESTO');

-- CreateEnum
CREATE TYPE "PlanCuotaModo" AS ENUM ('IGUALES', 'PRIMERA_MAYOR');

-- AlterTable
ALTER TABLE "StockPresentacion" ADD COLUMN     "compraRecepcionId" INTEGER;

-- CreateTable
CREATE TABLE "CompraRecepcion" (
    "id" SERIAL NOT NULL,
    "compraId" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" INTEGER NOT NULL,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompraRecepcion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompraRecepcionLinea" (
    "id" SERIAL NOT NULL,
    "compraRecepcionId" INTEGER NOT NULL,
    "compraDetalleId" INTEGER NOT NULL,
    "productoId" INTEGER NOT NULL,
    "presentacionId" INTEGER,
    "cantidadRecibida" INTEGER NOT NULL,
    "fechaExpiracion" TIMESTAMP(3),
    "stockPresentacionId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompraRecepcionLinea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CondicionPago" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "diasCredito" INTEGER,
    "cantidadCuotas" INTEGER,
    "diasEntreCuotas" INTEGER,
    "interes" DECIMAL(5,2),
    "tipoInteres" "InteresTipo" NOT NULL DEFAULT 'NONE',
    "modoGeneracion" "PlanCuotaModo" NOT NULL DEFAULT 'IGUALES',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CondicionPago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CxPDocumento" (
    "id" SERIAL NOT NULL,
    "proveedorId" INTEGER NOT NULL,
    "compraId" INTEGER,
    "folioProveedor" TEXT,
    "fechaEmision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaVencimiento" TIMESTAMP(3),
    "montoOriginal" DECIMAL(14,2) NOT NULL,
    "saldoPendiente" DECIMAL(14,2) NOT NULL,
    "interesTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "estado" "CxPEstado" NOT NULL DEFAULT 'PENDIENTE',
    "condicionPagoId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CxPDocumento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CxPCuota" (
    "id" SERIAL NOT NULL,
    "documentoId" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "fechaVencimiento" TIMESTAMP(3) NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "saldo" DECIMAL(14,2) NOT NULL,
    "estado" "CuotaEstado" NOT NULL DEFAULT 'PENDIENTE',
    "pagadaEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CxPCuota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CxPPago" (
    "id" SERIAL NOT NULL,
    "documentoId" INTEGER NOT NULL,
    "fechaPago" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "monto" DECIMAL(14,2) NOT NULL,
    "metodoPago" "MetodoPago" NOT NULL,
    "referencia" TEXT,
    "observaciones" TEXT,
    "movimientoFinancieroId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CxPPago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CxPPagoCuota" (
    "pagoId" INTEGER NOT NULL,
    "cuotaId" INTEGER NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "CxPPagoCuota_pkey" PRIMARY KEY ("pagoId","cuotaId")
);

-- CreateIndex
CREATE INDEX "CompraRecepcion_compraId_fecha_idx" ON "CompraRecepcion"("compraId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "CompraRecepcionLinea_stockPresentacionId_key" ON "CompraRecepcionLinea"("stockPresentacionId");

-- CreateIndex
CREATE INDEX "CompraRecepcionLinea_compraDetalleId_idx" ON "CompraRecepcionLinea"("compraDetalleId");

-- CreateIndex
CREATE INDEX "CxPDocumento_proveedorId_estado_idx" ON "CxPDocumento"("proveedorId", "estado");

-- CreateIndex
CREATE INDEX "CxPDocumento_compraId_idx" ON "CxPDocumento"("compraId");

-- CreateIndex
CREATE INDEX "CxPCuota_estado_fechaVencimiento_idx" ON "CxPCuota"("estado", "fechaVencimiento");

-- CreateIndex
CREATE UNIQUE INDEX "CxPCuota_documentoId_numero_key" ON "CxPCuota"("documentoId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "CxPPago_movimientoFinancieroId_key" ON "CxPPago"("movimientoFinancieroId");

-- CreateIndex
CREATE INDEX "CxPPago_documentoId_fechaPago_idx" ON "CxPPago"("documentoId", "fechaPago");

-- AddForeignKey
ALTER TABLE "StockPresentacion" ADD CONSTRAINT "StockPresentacion_compraRecepcionId_fkey" FOREIGN KEY ("compraRecepcionId") REFERENCES "CompraRecepcion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompraRecepcion" ADD CONSTRAINT "CompraRecepcion_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "Compra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompraRecepcion" ADD CONSTRAINT "CompraRecepcion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompraRecepcionLinea" ADD CONSTRAINT "CompraRecepcionLinea_compraRecepcionId_fkey" FOREIGN KEY ("compraRecepcionId") REFERENCES "CompraRecepcion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompraRecepcionLinea" ADD CONSTRAINT "CompraRecepcionLinea_compraDetalleId_fkey" FOREIGN KEY ("compraDetalleId") REFERENCES "CompraDetalle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompraRecepcionLinea" ADD CONSTRAINT "CompraRecepcionLinea_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompraRecepcionLinea" ADD CONSTRAINT "CompraRecepcionLinea_presentacionId_fkey" FOREIGN KEY ("presentacionId") REFERENCES "ProductoPresentacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompraRecepcionLinea" ADD CONSTRAINT "CompraRecepcionLinea_stockPresentacionId_fkey" FOREIGN KEY ("stockPresentacionId") REFERENCES "StockPresentacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CxPDocumento" ADD CONSTRAINT "CxPDocumento_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CxPDocumento" ADD CONSTRAINT "CxPDocumento_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "Compra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CxPDocumento" ADD CONSTRAINT "CxPDocumento_condicionPagoId_fkey" FOREIGN KEY ("condicionPagoId") REFERENCES "CondicionPago"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CxPCuota" ADD CONSTRAINT "CxPCuota_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "CxPDocumento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CxPPago" ADD CONSTRAINT "CxPPago_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "CxPDocumento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CxPPago" ADD CONSTRAINT "CxPPago_movimientoFinancieroId_fkey" FOREIGN KEY ("movimientoFinancieroId") REFERENCES "MovimientoFinanciero"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CxPPagoCuota" ADD CONSTRAINT "CxPPagoCuota_pagoId_fkey" FOREIGN KEY ("pagoId") REFERENCES "CxPPago"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CxPPagoCuota" ADD CONSTRAINT "CxPPagoCuota_cuotaId_fkey" FOREIGN KEY ("cuotaId") REFERENCES "CxPCuota"("id") ON DELETE CASCADE ON UPDATE CASCADE;
