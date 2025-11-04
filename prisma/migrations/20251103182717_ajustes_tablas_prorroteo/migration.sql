-- CreateEnum
CREATE TYPE "MetodoProrrateo" AS ENUM ('VALOR', 'UNIDADES', 'PESO', 'VOLUMEN');

-- CreateEnum
CREATE TYPE "EstadoProrrateo" AS ENUM ('APLICADO', 'ANULADO');

-- AlterTable
ALTER TABLE "MovimientoFinanciero" ADD COLUMN     "compraDetalleId" INTEGER,
ADD COLUMN     "compraId" INTEGER,
ADD COLUMN     "compraRecepcionId" INTEGER,
ADD COLUMN     "requisicionRecepcionId" INTEGER;

-- AlterTable
ALTER TABLE "Stock" ADD COLUMN     "compraRecepcionId" INTEGER;

-- CreateTable
CREATE TABLE "Prorrateo" (
    "id" SERIAL NOT NULL,
    "sucursalId" INTEGER NOT NULL,
    "metodo" "MetodoProrrateo" NOT NULL,
    "montoTotal" DOUBLE PRECISION NOT NULL,
    "compraId" INTEGER,
    "compraRecepcionId" INTEGER,
    "compraDetalleId" INTEGER,
    "requisicionRecepcionId" INTEGER,
    "entregaStockId" INTEGER,
    "movimientoFinancieroId" INTEGER,
    "cxpDocumentoLineaId" INTEGER,
    "estado" "EstadoProrrateo" NOT NULL DEFAULT 'APLICADO',
    "comentario" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Prorrateo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProrrateoDetalle" (
    "id" SERIAL NOT NULL,
    "prorrateoId" INTEGER NOT NULL,
    "stockId" INTEGER NOT NULL,
    "cantidadBase" INTEGER NOT NULL,
    "valorBase" DOUBLE PRECISION NOT NULL,
    "montoAsignado" DOUBLE PRECISION NOT NULL,
    "precioCostoAntes" DOUBLE PRECISION NOT NULL,
    "precioCostoDesp" DOUBLE PRECISION NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProrrateoDetalle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Prorrateo_sucursalId_idx" ON "Prorrateo"("sucursalId");

-- CreateIndex
CREATE INDEX "Prorrateo_compraId_idx" ON "Prorrateo"("compraId");

-- CreateIndex
CREATE INDEX "Prorrateo_compraRecepcionId_idx" ON "Prorrateo"("compraRecepcionId");

-- CreateIndex
CREATE INDEX "Prorrateo_compraDetalleId_idx" ON "Prorrateo"("compraDetalleId");

-- CreateIndex
CREATE INDEX "Prorrateo_requisicionRecepcionId_idx" ON "Prorrateo"("requisicionRecepcionId");

-- CreateIndex
CREATE INDEX "Prorrateo_entregaStockId_idx" ON "Prorrateo"("entregaStockId");

-- CreateIndex
CREATE UNIQUE INDEX "Prorrateo_movimientoFinancieroId_key" ON "Prorrateo"("movimientoFinancieroId");

-- CreateIndex
CREATE UNIQUE INDEX "Prorrateo_cxpDocumentoLineaId_key" ON "Prorrateo"("cxpDocumentoLineaId");

-- CreateIndex
CREATE INDEX "ProrrateoDetalle_prorrateoId_idx" ON "ProrrateoDetalle"("prorrateoId");

-- CreateIndex
CREATE INDEX "ProrrateoDetalle_stockId_idx" ON "ProrrateoDetalle"("stockId");

-- AddForeignKey
ALTER TABLE "Stock" ADD CONSTRAINT "Stock_compraRecepcionId_fkey" FOREIGN KEY ("compraRecepcionId") REFERENCES "CompraRecepcion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoFinanciero" ADD CONSTRAINT "MovimientoFinanciero_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "Compra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoFinanciero" ADD CONSTRAINT "MovimientoFinanciero_compraRecepcionId_fkey" FOREIGN KEY ("compraRecepcionId") REFERENCES "CompraRecepcion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoFinanciero" ADD CONSTRAINT "MovimientoFinanciero_compraDetalleId_fkey" FOREIGN KEY ("compraDetalleId") REFERENCES "CompraDetalle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoFinanciero" ADD CONSTRAINT "MovimientoFinanciero_requisicionRecepcionId_fkey" FOREIGN KEY ("requisicionRecepcionId") REFERENCES "RequisicionRecepcion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prorrateo" ADD CONSTRAINT "Prorrateo_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prorrateo" ADD CONSTRAINT "Prorrateo_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "Compra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prorrateo" ADD CONSTRAINT "Prorrateo_compraRecepcionId_fkey" FOREIGN KEY ("compraRecepcionId") REFERENCES "CompraRecepcion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prorrateo" ADD CONSTRAINT "Prorrateo_compraDetalleId_fkey" FOREIGN KEY ("compraDetalleId") REFERENCES "CompraDetalle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prorrateo" ADD CONSTRAINT "Prorrateo_requisicionRecepcionId_fkey" FOREIGN KEY ("requisicionRecepcionId") REFERENCES "RequisicionRecepcion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prorrateo" ADD CONSTRAINT "Prorrateo_entregaStockId_fkey" FOREIGN KEY ("entregaStockId") REFERENCES "EntregaStock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prorrateo" ADD CONSTRAINT "Prorrateo_movimientoFinancieroId_fkey" FOREIGN KEY ("movimientoFinancieroId") REFERENCES "MovimientoFinanciero"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProrrateoDetalle" ADD CONSTRAINT "ProrrateoDetalle_prorrateoId_fkey" FOREIGN KEY ("prorrateoId") REFERENCES "Prorrateo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProrrateoDetalle" ADD CONSTRAINT "ProrrateoDetalle_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock"("id") ON DELETE CASCADE ON UPDATE CASCADE;
