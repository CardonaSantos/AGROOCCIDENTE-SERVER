/*
  Warnings:

  - A unique constraint covering the columns `[dpi]` on the table `Cliente` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[nit]` on the table `Cliente` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Cliente" ADD COLUMN     "nit" TEXT;

-- AlterTable
ALTER TABLE "Cuota" ADD COLUMN     "fechaUltimoCalculoMora" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_dpi_key" ON "Cliente"("dpi");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_nit_key" ON "Cliente"("nit");
