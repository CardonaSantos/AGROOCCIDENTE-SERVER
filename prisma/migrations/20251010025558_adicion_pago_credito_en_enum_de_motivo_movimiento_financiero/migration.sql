/*
  Warnings:

  - Added the required column `usuarioId` to the `CxPDocumento` table without a default value. This is not possible if the table is not empty.
  - Added the required column `registradoPorId` to the `CxPPago` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "MotivoMovimiento" ADD VALUE 'PAGO_CREDITO';

-- AlterTable
ALTER TABLE "CxPDocumento" ADD COLUMN     "usuarioId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "CxPPago" ADD COLUMN     "registradoPorId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "CxPDocumento" ADD CONSTRAINT "CxPDocumento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CxPPago" ADD CONSTRAINT "CxPPago_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
