/*
  Warnings:

  - A unique constraint covering the columns `[stockId]` on the table `CompraRecepcionLinea` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "CompraRecepcionLinea" ADD COLUMN     "stockId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "CompraRecepcionLinea_stockId_key" ON "CompraRecepcionLinea"("stockId");

-- AddForeignKey
ALTER TABLE "CompraRecepcionLinea" ADD CONSTRAINT "CompraRecepcionLinea_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock"("id") ON DELETE SET NULL ON UPDATE CASCADE;
