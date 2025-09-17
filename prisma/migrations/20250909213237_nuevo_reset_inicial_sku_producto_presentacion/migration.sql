/*
  Warnings:

  - You are about to drop the column `clienteId` on the `PrecioProducto` table. All the data in the column will be lost.
  - You are about to drop the column `sucursalId` on the `PrecioProducto` table. All the data in the column will be lost.
  - You are about to alter the column `precio` on the `PrecioProducto` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(12,4)`.

*/
-- AlterTable
ALTER TABLE "CompraDetalle" ADD COLUMN     "presentacionId" INTEGER;

-- AlterTable
ALTER TABLE "PedidoLinea" ADD COLUMN     "presentacionId" INTEGER;

-- AlterTable
ALTER TABLE "PrecioProducto" DROP COLUMN "clienteId",
DROP COLUMN "sucursalId",
ADD COLUMN     "presentacionId" INTEGER,
ALTER COLUMN "precio" SET DATA TYPE DECIMAL(12,4);

-- AlterTable
ALTER TABLE "Producto" ADD COLUMN     "unidadBase" TEXT NOT NULL DEFAULT 'unidades';

-- AlterTable
ALTER TABLE "RequisicionLinea" ADD COLUMN     "presentacionId" INTEGER;

-- AlterTable
ALTER TABLE "VentaProducto" ADD COLUMN     "presentacionId" INTEGER;

-- CreateTable
CREATE TABLE "ProductoPresentacion" (
    "id" SERIAL NOT NULL,
    "productoId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "factorUnidadBase" DECIMAL(18,6) NOT NULL,
    "sku" TEXT,
    "codigoBarras" TEXT,
    "esDefault" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductoPresentacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockPresentacion" (
    "id" SERIAL NOT NULL,
    "productoId" INTEGER NOT NULL,
    "presentacionId" INTEGER NOT NULL,
    "sucursalId" INTEGER NOT NULL,
    "cantidadPresentacion" INTEGER NOT NULL,
    "costoUnitarioBase" DECIMAL(12,4) NOT NULL,
    "costoUnitarioPresentacion" DECIMAL(12,4),
    "fechaIngreso" TIMESTAMP(3) NOT NULL,
    "fechaVencimiento" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockPresentacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductoPresentacion_sku_key" ON "ProductoPresentacion"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "ProductoPresentacion_codigoBarras_key" ON "ProductoPresentacion"("codigoBarras");

-- CreateIndex
CREATE INDEX "ProductoPresentacion_productoId_idx" ON "ProductoPresentacion"("productoId");

-- CreateIndex
CREATE INDEX "ProductoPresentacion_sku_idx" ON "ProductoPresentacion"("sku");

-- CreateIndex
CREATE INDEX "ProductoPresentacion_codigoBarras_idx" ON "ProductoPresentacion"("codigoBarras");

-- CreateIndex
CREATE UNIQUE INDEX "ProductoPresentacion_productoId_nombre_key" ON "ProductoPresentacion"("productoId", "nombre");

-- CreateIndex
CREATE INDEX "StockPresentacion_productoId_sucursalId_idx" ON "StockPresentacion"("productoId", "sucursalId");

-- CreateIndex
CREATE INDEX "StockPresentacion_presentacionId_sucursalId_idx" ON "StockPresentacion"("presentacionId", "sucursalId");

-- CreateIndex
CREATE INDEX "PrecioProducto_productoId_presentacionId_estado_orden_idx" ON "PrecioProducto"("productoId", "presentacionId", "estado", "orden");

-- AddForeignKey
ALTER TABLE "ProductoPresentacion" ADD CONSTRAINT "ProductoPresentacion_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockPresentacion" ADD CONSTRAINT "StockPresentacion_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockPresentacion" ADD CONSTRAINT "StockPresentacion_presentacionId_fkey" FOREIGN KEY ("presentacionId") REFERENCES "ProductoPresentacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockPresentacion" ADD CONSTRAINT "StockPresentacion_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrecioProducto" ADD CONSTRAINT "PrecioProducto_presentacionId_fkey" FOREIGN KEY ("presentacionId") REFERENCES "ProductoPresentacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VentaProducto" ADD CONSTRAINT "VentaProducto_presentacionId_fkey" FOREIGN KEY ("presentacionId") REFERENCES "ProductoPresentacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequisicionLinea" ADD CONSTRAINT "RequisicionLinea_presentacionId_fkey" FOREIGN KEY ("presentacionId") REFERENCES "ProductoPresentacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompraDetalle" ADD CONSTRAINT "CompraDetalle_presentacionId_fkey" FOREIGN KEY ("presentacionId") REFERENCES "ProductoPresentacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoLinea" ADD CONSTRAINT "PedidoLinea_presentacionId_fkey" FOREIGN KEY ("presentacionId") REFERENCES "ProductoPresentacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
