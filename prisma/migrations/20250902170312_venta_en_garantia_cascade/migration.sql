-- DropForeignKey
ALTER TABLE "Garantia" DROP CONSTRAINT "Garantia_ventaId_fkey";

-- AddForeignKey
ALTER TABLE "Garantia" ADD CONSTRAINT "Garantia_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta"("id") ON DELETE CASCADE ON UPDATE CASCADE;
