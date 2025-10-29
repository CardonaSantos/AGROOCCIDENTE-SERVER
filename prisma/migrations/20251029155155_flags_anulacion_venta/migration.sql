-- AlterTable
ALTER TABLE "Venta" ADD COLUMN     "anulada" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "anuladaPorId" INTEGER,
ADD COLUMN     "fechaAnulacion" TIMESTAMP(3),
ADD COLUMN     "motivoAnulacion" TEXT;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_anuladaPorId_fkey" FOREIGN KEY ("anuladaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
