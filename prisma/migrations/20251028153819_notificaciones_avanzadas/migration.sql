/*
  Warnings:

  - You are about to drop the column `tipoNotificacion` on the `Notificacion` table. All the data in the column will be lost.
  - You are about to drop the `_Destinatario` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[usuarioId,notificacionId]` on the table `NotificacionesUsuarios` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "NotiCategory" AS ENUM ('VENTAS', 'INVENTARIO', 'CREDITO', 'CUENTAS_POR_PAGAR', 'GARANTIA', 'REPARACIONES', 'COMPRAS', 'LOGISTICA', 'SISTEMA', 'SEGURIDAD', 'FACTURACION', 'OTROS');

-- CreateEnum
CREATE TYPE "NotiSeverity" AS ENUM ('INFORMACION', 'EXITO', 'ALERTA', 'ERROR', 'CRITICO');

-- CreateEnum
CREATE TYPE "NotiAudience" AS ENUM ('USUARIOS', 'ROL', 'SUCURSAL', 'GLOBAL');

-- DropForeignKey
ALTER TABLE "_Destinatario" DROP CONSTRAINT "_Destinatario_A_fkey";

-- DropForeignKey
ALTER TABLE "_Destinatario" DROP CONSTRAINT "_Destinatario_B_fkey";

-- AlterTable
ALTER TABLE "Notificacion" DROP COLUMN "tipoNotificacion",
ADD COLUMN     "actionLabel" TEXT,
ADD COLUMN     "audiencia" "NotiAudience" NOT NULL DEFAULT 'USUARIOS',
ADD COLUMN     "categoria" "NotiCategory" NOT NULL DEFAULT 'OTROS',
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "meta" JSONB,
ADD COLUMN     "referenciaTipo" TEXT,
ADD COLUMN     "route" TEXT,
ADD COLUMN     "scheduledAt" TIMESTAMP(3),
ADD COLUMN     "severidad" "NotiSeverity" NOT NULL DEFAULT 'INFORMACION',
ADD COLUMN     "subtipo" TEXT,
ADD COLUMN     "sucursalId" INTEGER,
ADD COLUMN     "titulo" TEXT,
ADD COLUMN     "visibleFrom" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "NotificacionesUsuarios" ADD COLUMN     "dismissedAt" TIMESTAMP(3),
ADD COLUMN     "pinnedUntil" TIMESTAMP(3);

-- DropTable
DROP TABLE "_Destinatario";

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "categoria" "NotiCategory" NOT NULL,
    "subtipo" TEXT,
    "sucursalId" INTEGER,
    "inApp" BOOLEAN NOT NULL DEFAULT true,
    "email" BOOLEAN NOT NULL DEFAULT false,
    "push" BOOLEAN NOT NULL DEFAULT false,
    "minSeverity" "NotiSeverity" NOT NULL DEFAULT 'INFORMACION',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_usuarioId_categoria_subtipo_sucursal_key" ON "NotificationPreference"("usuarioId", "categoria", "subtipo", "sucursalId");

-- CreateIndex
CREATE INDEX "Notificacion_categoria_severidad_fechaCreacion_idx" ON "Notificacion"("categoria", "severidad", "fechaCreacion");

-- CreateIndex
CREATE INDEX "Notificacion_sucursalId_fechaCreacion_idx" ON "Notificacion"("sucursalId", "fechaCreacion");

-- CreateIndex
CREATE INDEX "Notificacion_referenciaTipo_referenciaId_idx" ON "Notificacion"("referenciaTipo", "referenciaId");

-- CreateIndex
CREATE INDEX "Notificacion_fechaCreacion_idx" ON "Notificacion"("fechaCreacion");

-- CreateIndex
CREATE INDEX "NotificacionesUsuarios_usuarioId_eliminado_leido_recibidoEn_idx" ON "NotificacionesUsuarios"("usuarioId", "eliminado", "leido", "recibidoEn");

-- CreateIndex
CREATE UNIQUE INDEX "NotificacionesUsuarios_usuarioId_notificacionId_key" ON "NotificacionesUsuarios"("usuarioId", "notificacionId");

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
