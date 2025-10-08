/*
  Warnings:

  - You are about to drop the column `sku` on the `ProductoPresentacion` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "ProductoPresentacion_sku_idx";

-- DropIndex
DROP INDEX "ProductoPresentacion_sku_key";

-- AlterTable
ALTER TABLE "ProductoPresentacion" DROP COLUMN "sku";
