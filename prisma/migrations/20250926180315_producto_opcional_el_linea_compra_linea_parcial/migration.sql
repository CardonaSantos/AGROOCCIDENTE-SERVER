-- DropForeignKey
ALTER TABLE "CompraRecepcionLinea" DROP CONSTRAINT "CompraRecepcionLinea_productoId_fkey";

-- AlterTable
ALTER TABLE "CompraRecepcionLinea" ALTER COLUMN "productoId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "CompraRecepcionLinea" ADD CONSTRAINT "CompraRecepcionLinea_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
