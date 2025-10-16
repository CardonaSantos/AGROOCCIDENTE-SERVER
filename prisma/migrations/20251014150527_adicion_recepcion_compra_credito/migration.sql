/*
  Warnings:

  - A unique constraint covering the columns `[proveedorId,folioProveedor]` on the table `CxPDocumento` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "CxPPago" ADD COLUMN     "compraRecepcionId" INTEGER;

-- CreateTable
CREATE TABLE "CxPDocumentoRecepcion" (
    "documentoId" INTEGER NOT NULL,
    "recepcionId" INTEGER NOT NULL,
    "montoAsociado" DECIMAL(14,2),

    CONSTRAINT "CxPDocumentoRecepcion_pkey" PRIMARY KEY ("documentoId","recepcionId")
);

-- CreateTable
CREATE TABLE "CxPDocumentoLinea" (
    "id" SERIAL NOT NULL,
    "documentoId" INTEGER NOT NULL,
    "compraDetalleId" INTEGER,
    "presentacionId" INTEGER,
    "descripcion" TEXT,
    "cantidad" INTEGER,
    "costoUnitario" DECIMAL(12,4),
    "subtotal" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "CxPDocumentoLinea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CxPDocumentoRecepcion_recepcionId_idx" ON "CxPDocumentoRecepcion"("recepcionId");

-- CreateIndex
CREATE UNIQUE INDEX "CxPDocumento_proveedorId_folioProveedor_key" ON "CxPDocumento"("proveedorId", "folioProveedor");

-- AddForeignKey
ALTER TABLE "CxPDocumentoRecepcion" ADD CONSTRAINT "CxPDocumentoRecepcion_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "CxPDocumento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CxPDocumentoRecepcion" ADD CONSTRAINT "CxPDocumentoRecepcion_recepcionId_fkey" FOREIGN KEY ("recepcionId") REFERENCES "CompraRecepcion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CxPPago" ADD CONSTRAINT "CxPPago_compraRecepcionId_fkey" FOREIGN KEY ("compraRecepcionId") REFERENCES "CompraRecepcion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CxPDocumentoLinea" ADD CONSTRAINT "CxPDocumentoLinea_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "CxPDocumento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CxPDocumentoLinea" ADD CONSTRAINT "CxPDocumentoLinea_compraDetalleId_fkey" FOREIGN KEY ("compraDetalleId") REFERENCES "CompraDetalle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CxPDocumentoLinea" ADD CONSTRAINT "CxPDocumentoLinea_presentacionId_fkey" FOREIGN KEY ("presentacionId") REFERENCES "ProductoPresentacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
