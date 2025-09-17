/*
  Warnings:

  - Added the required column `updatedAt` to the `PedidoLinea` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cantidadRecibidaInicial` to the `StockPresentacion` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "HistorialStock" ADD COLUMN     "presentacionId" INTEGER;

-- AlterTable
ALTER TABLE "PedidoLinea" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "fechaExpiracion" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "StockPresentacion" ADD COLUMN     "cantidadRecibidaInicial" INTEGER NOT NULL,
ADD COLUMN     "requisicionRecepcionId" INTEGER;

-- AddForeignKey
ALTER TABLE "StockPresentacion" ADD CONSTRAINT "StockPresentacion_requisicionRecepcionId_fkey" FOREIGN KEY ("requisicionRecepcionId") REFERENCES "RequisicionRecepcion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistorialStock" ADD CONSTRAINT "HistorialStock_presentacionId_fkey" FOREIGN KEY ("presentacionId") REFERENCES "ProductoPresentacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
