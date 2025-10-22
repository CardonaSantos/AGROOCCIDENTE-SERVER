/*
  Warnings:

  - Added the required column `precioSeleccionadoId` to the `SolicitudCreditoVentaLinea` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "SolicitudCreditoVentaLinea" ADD COLUMN     "precioSeleccionadoId" INTEGER NOT NULL;
