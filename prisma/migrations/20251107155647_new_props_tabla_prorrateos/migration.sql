-- AlterTable
ALTER TABLE "ProrrateoDetalle" ADD COLUMN     "costoProrrateadoTotalInversion" DOUBLE PRECISION,
ADD COLUMN     "costoUnitarioProrrateado" DOUBLE PRECISION,
ADD COLUMN     "existenciasPrevias" INTEGER,
ADD COLUMN     "inversionPrevias" DOUBLE PRECISION,
ADD COLUMN     "nuevasExistencias" INTEGER;
