/*
  Warnings:

  - Added the required column `updatedAt` to the `MetaUsuario` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "RegistroCaja_sucursalId_estado_idx";

-- AlterTable
ALTER TABLE "MetaUsuario" ADD COLUMN     "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "RegistroCaja_sucursalId_estado_fechaCierre_idx" ON "RegistroCaja"("sucursalId", "estado", "fechaCierre");

-- CreateIndex
CREATE INDEX "RegistroCaja_sucursalId_usuarioInicioId_estado_fechaCierre_idx" ON "RegistroCaja"("sucursalId", "usuarioInicioId", "estado", "fechaCierre");
