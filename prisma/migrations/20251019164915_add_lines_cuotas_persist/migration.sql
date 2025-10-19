-- CreateEnum
CREATE TYPE "TipoCuotaPropuesta" AS ENUM ('NORMAL', 'ENGANCHE');

-- CreateEnum
CREATE TYPE "OrigenCuotaPropuesta" AS ENUM ('AUTO', 'MANUAL');

-- CreateTable
CREATE TABLE "SolicitudCreditoVentaCuota" (
    "id" SERIAL NOT NULL,
    "solicitudId" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "etiqueta" "TipoCuotaPropuesta" NOT NULL DEFAULT 'NORMAL',
    "origen" "OrigenCuotaPropuesta" NOT NULL DEFAULT 'AUTO',
    "esManual" BOOLEAN NOT NULL DEFAULT false,
    "montoCapital" DOUBLE PRECISION,
    "montoInteres" DOUBLE PRECISION,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SolicitudCreditoVentaCuota_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SolicitudCreditoVentaCuota_solicitudId_fecha_idx" ON "SolicitudCreditoVentaCuota"("solicitudId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "SolicitudCreditoVentaCuota_solicitudId_numero_key" ON "SolicitudCreditoVentaCuota"("solicitudId", "numero");

-- AddForeignKey
ALTER TABLE "SolicitudCreditoVentaCuota" ADD CONSTRAINT "SolicitudCreditoVentaCuota_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "SolicitudCreditoVenta"("id") ON DELETE CASCADE ON UPDATE CASCADE;
