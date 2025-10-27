/*
  Warnings:

  - You are about to drop the column `tipoPresentacion` on the `ProductoPresentacion` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Producto" ADD COLUMN     "tipoPresentacionId" INTEGER;

-- AlterTable
ALTER TABLE "ProductoPresentacion" DROP COLUMN "tipoPresentacion",
ADD COLUMN     "tipoPresentacionId" INTEGER;

-- CreateTable
CREATE TABLE "TipoPresentacion" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TipoPresentacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TipoPresentacion_nombre_key" ON "TipoPresentacion"("nombre");

-- AddForeignKey
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_tipoPresentacionId_fkey" FOREIGN KEY ("tipoPresentacionId") REFERENCES "TipoPresentacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoPresentacion" ADD CONSTRAINT "ProductoPresentacion_tipoPresentacionId_fkey" FOREIGN KEY ("tipoPresentacionId") REFERENCES "TipoPresentacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
