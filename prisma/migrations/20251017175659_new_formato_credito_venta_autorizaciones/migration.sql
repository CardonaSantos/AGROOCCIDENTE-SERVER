/*
  Warnings:

  - A unique constraint covering the columns `[ventaCuotaId,numero]` on the table `Cuota` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[numeroCredito]` on the table `VentaCuota` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `numero` to the `Cuota` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "FrecuenciaPago" AS ENUM ('SEMANAL', 'QUINCENAL', 'MENSUAL');

-- CreateEnum
CREATE TYPE "AccionCredito" AS ENUM ('CREADO', 'CAMBIO_ESTADO', 'ABONO', 'REPROGRAMADO', 'MORA_REGISTRADA', 'MORA_CONDONADA', 'AJUSTE_MANUAL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EstadoCuota" ADD VALUE 'EN_MORA';
ALTER TYPE "EstadoCuota" ADD VALUE 'REPROGRAMADA';
ALTER TYPE "EstadoCuota" ADD VALUE 'PAUSADA';

-- AlterEnum
ALTER TYPE "EstadoPago" ADD VALUE 'PARCIAL';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PlanCuotaModo" ADD VALUE 'CRECIENTES';
ALTER TYPE "PlanCuotaModo" ADD VALUE 'DECRECIENTES';

-- AlterTable
ALTER TABLE "Cuota" ADD COLUMN     "montoCapital" DOUBLE PRECISION,
ADD COLUMN     "montoInteres" DOUBLE PRECISION,
ADD COLUMN     "montoPagado" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "moraAcumulada" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "numero" INTEGER NOT NULL,
ADD COLUMN     "saldoPendiente" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "VentaCuota" ADD COLUMN     "diasGracia" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "fechaProximoPago" TIMESTAMP(3),
ADD COLUMN     "frecuenciaPago" "FrecuenciaPago" NOT NULL DEFAULT 'MENSUAL',
ADD COLUMN     "interesTipo" "InteresTipo" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "moraDiaria" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "numeroCredito" TEXT,
ADD COLUMN     "planCuotaModo" "PlanCuotaModo" NOT NULL DEFAULT 'IGUALES',
ALTER COLUMN "montoTotalConInteres" SET DATA TYPE DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "AbonoCredito" (
    "id" SERIAL NOT NULL,
    "ventaCuotaId" INTEGER NOT NULL,
    "sucursalId" INTEGER NOT NULL,
    "registroCajaId" INTEGER,
    "usuarioId" INTEGER NOT NULL,
    "metodoPago" "MetodoPago" NOT NULL,
    "referenciaPago" TEXT,
    "fechaAbono" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "montoTotal" DOUBLE PRECISION NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AbonoCredito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbonoCuota" (
    "id" SERIAL NOT NULL,
    "abonoId" INTEGER NOT NULL,
    "cuotaId" INTEGER NOT NULL,
    "montoCapital" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "montoInteres" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "montoMora" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "montoTotal" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "AbonoCuota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VentaCuotaHistorial" (
    "id" SERIAL NOT NULL,
    "ventaCuotaId" INTEGER NOT NULL,
    "accion" "AccionCredito" NOT NULL,
    "comentario" TEXT,
    "usuarioId" INTEGER,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VentaCuotaHistorial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AbonoCredito_ventaCuotaId_fechaAbono_idx" ON "AbonoCredito"("ventaCuotaId", "fechaAbono");

-- CreateIndex
CREATE INDEX "AbonoCredito_sucursalId_fechaAbono_idx" ON "AbonoCredito"("sucursalId", "fechaAbono");

-- CreateIndex
CREATE INDEX "AbonoCuota_cuotaId_idx" ON "AbonoCuota"("cuotaId");

-- CreateIndex
CREATE UNIQUE INDEX "AbonoCuota_abonoId_cuotaId_key" ON "AbonoCuota"("abonoId", "cuotaId");

-- CreateIndex
CREATE INDEX "VentaCuotaHistorial_ventaCuotaId_fecha_idx" ON "VentaCuotaHistorial"("ventaCuotaId", "fecha");

-- CreateIndex
CREATE INDEX "Cuota_ventaCuotaId_estado_fechaVencimiento_idx" ON "Cuota"("ventaCuotaId", "estado", "fechaVencimiento");

-- CreateIndex
CREATE INDEX "Cuota_fechaVencimiento_idx" ON "Cuota"("fechaVencimiento");

-- CreateIndex
CREATE UNIQUE INDEX "Cuota_ventaCuotaId_numero_key" ON "Cuota"("ventaCuotaId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "VentaCuota_numeroCredito_key" ON "VentaCuota"("numeroCredito");

-- CreateIndex
CREATE INDEX "VentaCuota_estado_sucursalId_fechaInicio_idx" ON "VentaCuota"("estado", "sucursalId", "fechaInicio");

-- AddForeignKey
ALTER TABLE "AbonoCredito" ADD CONSTRAINT "AbonoCredito_ventaCuotaId_fkey" FOREIGN KEY ("ventaCuotaId") REFERENCES "VentaCuota"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbonoCredito" ADD CONSTRAINT "AbonoCredito_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbonoCredito" ADD CONSTRAINT "AbonoCredito_registroCajaId_fkey" FOREIGN KEY ("registroCajaId") REFERENCES "RegistroCaja"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbonoCredito" ADD CONSTRAINT "AbonoCredito_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbonoCuota" ADD CONSTRAINT "AbonoCuota_abonoId_fkey" FOREIGN KEY ("abonoId") REFERENCES "AbonoCredito"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbonoCuota" ADD CONSTRAINT "AbonoCuota_cuotaId_fkey" FOREIGN KEY ("cuotaId") REFERENCES "Cuota"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VentaCuotaHistorial" ADD CONSTRAINT "VentaCuotaHistorial_ventaCuotaId_fkey" FOREIGN KEY ("ventaCuotaId") REFERENCES "VentaCuota"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VentaCuotaHistorial" ADD CONSTRAINT "VentaCuotaHistorial_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
