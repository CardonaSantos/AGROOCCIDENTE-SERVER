/*
  Warnings:

  - You are about to drop the `ImagenPresentacion` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `StockThresholdPresentacion` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[sku]` on the table `ProductoPresentacion` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `factorUnidadBase` to the `ProductoPresentacion` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "ImagenPresentacion" DROP CONSTRAINT "ImagenPresentacion_presentacionId_fkey";

-- DropForeignKey
ALTER TABLE "StockThresholdPresentacion" DROP CONSTRAINT "StockThresholdPresentacion_presentacionId_fkey";

-- AlterTable
ALTER TABLE "ProductoPresentacion" ADD COLUMN     "factorUnidadBase" DECIMAL(18,6) NOT NULL,
ADD COLUMN     "sku" TEXT;

-- DropTable
DROP TABLE "ImagenPresentacion";

-- DropTable
DROP TABLE "StockThresholdPresentacion";

-- CreateIndex
CREATE UNIQUE INDEX "ProductoPresentacion_sku_key" ON "ProductoPresentacion"("sku");

-- CreateIndex
CREATE INDEX "ProductoPresentacion_sku_idx" ON "ProductoPresentacion"("sku");
