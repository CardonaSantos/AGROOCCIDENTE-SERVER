/*
  Warnings:

  - A unique constraint covering the columns `[cuentaBancariaId,comprobanteTipo,comprobanteNumero]` on the table `MovimientoFinanciero` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ComprobanteTipo" AS ENUM ('DEPOSITO_BOLETA', 'TRANSFERENCIA', 'CHEQUE', 'TARJETA_VOUCHER', 'OTRO');

-- AlterTable
ALTER TABLE "MovimientoFinanciero" ADD COLUMN     "comprobanteFecha" TIMESTAMP(3),
ADD COLUMN     "comprobanteNumero" VARCHAR(64),
ADD COLUMN     "comprobanteTipo" "ComprobanteTipo",
ADD COLUMN     "comprobanteUrl" TEXT;

-- CreateIndex
CREATE INDEX "idx_movfin_comprobante_lookup" ON "MovimientoFinanciero"("comprobanteTipo", "comprobanteNumero");

-- CreateIndex
CREATE UNIQUE INDEX "uq_movfin_comprobante" ON "MovimientoFinanciero"("cuentaBancariaId", "comprobanteTipo", "comprobanteNumero");
