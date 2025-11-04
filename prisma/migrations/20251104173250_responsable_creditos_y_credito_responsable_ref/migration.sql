-- AlterTable
ALTER TABLE "VentaCuota" ADD COLUMN     "responsableCobroId" INTEGER;

-- CreateIndex
CREATE INDEX "VentaCuota_responsableCobroId_idx" ON "VentaCuota"("responsableCobroId");

-- AddForeignKey
ALTER TABLE "VentaCuota" ADD CONSTRAINT "VentaCuota_responsableCobroId_fkey" FOREIGN KEY ("responsableCobroId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
