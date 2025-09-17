/*
  Warnings:

  - You are about to drop the column `costoUnitarioBase` on the `StockPresentacion` table. All the data in the column will be lost.
  - You are about to drop the column `costoUnitarioPresentacion` on the `StockPresentacion` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "StockPresentacion" DROP COLUMN "costoUnitarioBase",
DROP COLUMN "costoUnitarioPresentacion";
