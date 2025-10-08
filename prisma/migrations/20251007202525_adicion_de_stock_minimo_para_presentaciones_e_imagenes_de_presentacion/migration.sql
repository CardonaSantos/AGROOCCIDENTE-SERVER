-- CreateTable
CREATE TABLE "ImagenPresentacion" (
    "id" SERIAL NOT NULL,
    "url" TEXT NOT NULL,
    "public_id" TEXT,
    "altTexto" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "presentacionId" INTEGER NOT NULL,

    CONSTRAINT "ImagenPresentacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockThresholdPresentacion" (
    "id" SERIAL NOT NULL,
    "presentacionId" INTEGER NOT NULL,
    "stockMinimo" INTEGER NOT NULL DEFAULT 0,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockThresholdPresentacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImagenPresentacion_presentacionId_idx" ON "ImagenPresentacion"("presentacionId");

-- CreateIndex
CREATE UNIQUE INDEX "StockThresholdPresentacion_presentacionId_key" ON "StockThresholdPresentacion"("presentacionId");

-- AddForeignKey
ALTER TABLE "ImagenPresentacion" ADD CONSTRAINT "ImagenPresentacion_presentacionId_fkey" FOREIGN KEY ("presentacionId") REFERENCES "ProductoPresentacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockThresholdPresentacion" ADD CONSTRAINT "StockThresholdPresentacion_presentacionId_fkey" FOREIGN KEY ("presentacionId") REFERENCES "ProductoPresentacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
