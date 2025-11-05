-- AlterTable
ALTER TABLE "ProrrateoDetalle" ADD COLUMN     "stockPresentacionId" INTEGER;

-- AlterTable
ALTER TABLE "StockPresentacion" ADD COLUMN     "costoTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "precioCosto" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "ProrrateoDetalle" ADD CONSTRAINT "ProrrateoDetalle_stockPresentacionId_fkey" FOREIGN KEY ("stockPresentacionId") REFERENCES "StockPresentacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
