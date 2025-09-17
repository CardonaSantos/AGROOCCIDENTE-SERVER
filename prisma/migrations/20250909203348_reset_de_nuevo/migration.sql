/*
  Warnings:

  - The values [MAYORISTA,ESPECIAL,CLIENTE_ESPECIAL] on the enum `RolPrecio` will be removed. If these variants are still used in the database, this will fail.
  - You are about to alter the column `total` on the `Compra` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(14,4)`.
  - You are about to alter the column `costoUnitario` on the `CompraDetalle` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(14,4)`.
  - You are about to alter the column `monto` on the `Cuota` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(14,4)`.
  - You are about to alter the column `montoEsperado` on the `Cuota` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(14,4)`.
  - You are about to alter the column `montoDepositado` on the `DepositoCobro` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(14,4)`.
  - You are about to alter the column `montoVenta` on the `DetalleResumenVenta` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(14,4)`.
  - You are about to alter the column `montoTotal` on the `EntregaStock` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(14,4)`.
  - You are about to alter the column `precioAnterior` on the `HistorialPrecio` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(12,4)`.
  - You are about to alter the column `precioNuevo` on the `HistorialPrecio` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(12,4)`.
  - You are about to alter the column `precioCostoAnterior` on the `HistorialPrecioCosto` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(12,4)`.
  - You are about to alter the column `precioCostoNuevo` on the `HistorialPrecioCosto` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(12,4)`.
  - You are about to drop the column `productoId` on the `HistorialStock` table. All the data in the column will be lost.
  - You are about to alter the column `montoMeta` on the `MetaCobros` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(14,4)`.
  - You are about to alter the column `montoActual` on the `MetaCobros` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(14,4)`.
  - You are about to alter the column `montoMeta` on the `MetaUsuario` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(14,4)`.
  - You are about to alter the column `montoActual` on the `MetaUsuario` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(14,4)`.
  - You are about to alter the column `numeroVentas` on the `MetaUsuario` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(14,4)`.
  - You are about to alter the column `monto` on the `Pago` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(14,4)`.
  - You are about to alter the column `totalPedido` on the `Pedido` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(14,4)`.
  - You are about to alter the column `precioUnitario` on the `PedidoLinea` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(14,4)`.
  - You are about to alter the column `subtotal` on the `PedidoLinea` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(14,4)`.
  - You are about to alter the column `precio` on the `PrecioProducto` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(12,4)`.
  - You are about to alter the column `precioCostoActual` on the `Producto` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(12,4)`.
  - You are about to alter the column `precioUnitario` on the `RequisicionLinea` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(12,4)`.
  - You are about to alter the column `totalVentas` on the `ResumenVenta` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(14,4)`.
  - You are about to alter the column `ticketPromedio` on the `ResumenVenta` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(14,4)`.
  - You are about to alter the column `precioSolicitado` on the `SolicitudPrecio` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(12,4)`.
  - You are about to drop the column `productoId` on the `Stock` table. All the data in the column will be lost.
  - You are about to alter the column `costoTotal` on the `Stock` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(14,4)`.
  - You are about to alter the column `precioCosto` on the `Stock` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(12,4)`.
  - You are about to alter the column `totalVenta` on the `Venta` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(14,4)`.
  - You are about to alter the column `totalVenta` on the `VentaCuota` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(14,4)`.
  - You are about to alter the column `cuotaInicial` on the `VentaCuota` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(14,4)`.
  - You are about to alter the column `montoVenta` on the `VentaCuota` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(14,4)`.
  - You are about to alter the column `totalPagado` on the `VentaCuota` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(14,4)`.
  - You are about to alter the column `totalVenta` on the `VentaEliminada` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(14,4)`.
  - You are about to alter the column `precioVenta` on the `VentaEliminadaProducto` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(12,4)`.
  - You are about to alter the column `precioVenta` on the `VentaProducto` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(12,4)`.
  - Made the column `montoEsperado` on table `Cuota` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `productoSkuId` to the `HistorialStock` table without a default value. This is not possible if the table is not empty.
  - Made the column `totalPedido` on table `Pedido` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `productoSkuId` to the `RequisicionLinea` table without a default value. This is not possible if the table is not empty.
  - Made the column `ticketPromedio` on table `ResumenVenta` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `productoSkuId` to the `Stock` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "UnidadMedida" AS ENUM ('UNIDAD', 'ML', 'L', 'GR', 'KG');

-- CreateEnum
CREATE TYPE "TipoPresentacion" AS ENUM ('UNITARIA', 'BOTELLA', 'BOLSA', 'CAJA', 'SACO', 'BALDE', 'BIDON');

-- AlterEnum
BEGIN;
CREATE TYPE "RolPrecio_new" AS ENUM ('PUBLICO', 'AGROSERVICIO', 'FINCA', 'DISTRIBUIDOR', 'PROMOCION');
ALTER TABLE "PrecioProducto" ALTER COLUMN "rol" TYPE "RolPrecio_new" USING ("rol"::text::"RolPrecio_new");
ALTER TYPE "RolPrecio" RENAME TO "RolPrecio_old";
ALTER TYPE "RolPrecio_new" RENAME TO "RolPrecio";
DROP TYPE "RolPrecio_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "HistorialStock" DROP CONSTRAINT "HistorialStock_productoId_fkey";

-- DropForeignKey
ALTER TABLE "Stock" DROP CONSTRAINT "Stock_productoId_fkey";

-- AlterTable
ALTER TABLE "Compra" ALTER COLUMN "total" SET DATA TYPE DECIMAL(14,4);

-- AlterTable
ALTER TABLE "CompraDetalle" ALTER COLUMN "costoUnitario" SET DATA TYPE DECIMAL(14,4);

-- AlterTable
ALTER TABLE "Cuota" ALTER COLUMN "monto" SET DATA TYPE DECIMAL(14,4),
ALTER COLUMN "montoEsperado" SET NOT NULL,
ALTER COLUMN "montoEsperado" SET DATA TYPE DECIMAL(14,4);

-- AlterTable
ALTER TABLE "DepositoCobro" ALTER COLUMN "montoDepositado" SET DATA TYPE DECIMAL(14,4);

-- AlterTable
ALTER TABLE "DetalleResumenVenta" ALTER COLUMN "montoVenta" SET DATA TYPE DECIMAL(14,4);

-- AlterTable
ALTER TABLE "EntregaStock" ALTER COLUMN "montoTotal" SET DATA TYPE DECIMAL(14,4);

-- AlterTable
ALTER TABLE "HistorialPrecio" ALTER COLUMN "precioAnterior" SET DATA TYPE DECIMAL(12,4),
ALTER COLUMN "precioNuevo" SET DATA TYPE DECIMAL(12,4);

-- AlterTable
ALTER TABLE "HistorialPrecioCosto" ALTER COLUMN "precioCostoAnterior" SET DATA TYPE DECIMAL(12,4),
ALTER COLUMN "precioCostoNuevo" SET DATA TYPE DECIMAL(12,4);

-- AlterTable
ALTER TABLE "HistorialStock" DROP COLUMN "productoId",
ADD COLUMN     "productoSkuId" INTEGER NOT NULL,
ADD COLUMN     "stockId" INTEGER;

-- AlterTable
ALTER TABLE "MetaCobros" ALTER COLUMN "montoMeta" SET DATA TYPE DECIMAL(14,4),
ALTER COLUMN "montoActual" SET DATA TYPE DECIMAL(14,4);

-- AlterTable
ALTER TABLE "MetaUsuario" ALTER COLUMN "montoMeta" SET DATA TYPE DECIMAL(14,4),
ALTER COLUMN "montoActual" SET DATA TYPE DECIMAL(14,4),
ALTER COLUMN "numeroVentas" SET DATA TYPE DECIMAL(14,4);

-- AlterTable
ALTER TABLE "Pago" ALTER COLUMN "monto" SET DATA TYPE DECIMAL(14,4);

-- AlterTable
ALTER TABLE "Pedido" ALTER COLUMN "totalPedido" SET NOT NULL,
ALTER COLUMN "totalPedido" SET DATA TYPE DECIMAL(14,4);

-- AlterTable
ALTER TABLE "PedidoLinea" ALTER COLUMN "precioUnitario" SET DATA TYPE DECIMAL(14,4),
ALTER COLUMN "subtotal" SET DATA TYPE DECIMAL(14,4);

-- AlterTable
ALTER TABLE "PrecioProducto" ADD COLUMN     "productoSkuId" INTEGER,
ALTER COLUMN "precio" SET DATA TYPE DECIMAL(12,4);

-- AlterTable
ALTER TABLE "Producto" ADD COLUMN     "unidadBase" "UnidadMedida" NOT NULL DEFAULT 'UNIDAD',
ALTER COLUMN "precioCostoActual" SET DATA TYPE DECIMAL(12,4);

-- AlterTable
ALTER TABLE "RequisicionLinea" ADD COLUMN     "productoSkuId" INTEGER NOT NULL,
ALTER COLUMN "precioUnitario" SET DATA TYPE DECIMAL(12,4);

-- AlterTable
ALTER TABLE "ResumenVenta" ALTER COLUMN "totalVentas" SET DATA TYPE DECIMAL(14,4),
ALTER COLUMN "ticketPromedio" SET NOT NULL,
ALTER COLUMN "ticketPromedio" SET DATA TYPE DECIMAL(14,4);

-- AlterTable
ALTER TABLE "SolicitudPrecio" ALTER COLUMN "precioSolicitado" SET DATA TYPE DECIMAL(12,4);

-- AlterTable
ALTER TABLE "Stock" DROP COLUMN "productoId",
ADD COLUMN     "fabricadoEn" TIMESTAMP(3),
ADD COLUMN     "loteCodigo" TEXT,
ADD COLUMN     "productoSkuId" INTEGER NOT NULL,
ALTER COLUMN "costoTotal" SET DATA TYPE DECIMAL(14,4),
ALTER COLUMN "precioCosto" SET DATA TYPE DECIMAL(12,4),
ALTER COLUMN "actualizadoEn" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Venta" ALTER COLUMN "totalVenta" SET DATA TYPE DECIMAL(14,4);

-- AlterTable
ALTER TABLE "VentaCuota" ALTER COLUMN "totalVenta" SET DATA TYPE DECIMAL(14,4),
ALTER COLUMN "cuotaInicial" SET DATA TYPE DECIMAL(14,4),
ALTER COLUMN "montoVenta" SET DATA TYPE DECIMAL(14,4),
ALTER COLUMN "totalPagado" SET DATA TYPE DECIMAL(14,4);

-- AlterTable
ALTER TABLE "VentaEliminada" ALTER COLUMN "totalVenta" SET DATA TYPE DECIMAL(14,4);

-- AlterTable
ALTER TABLE "VentaEliminadaProducto" ALTER COLUMN "precioVenta" SET DATA TYPE DECIMAL(12,4);

-- AlterTable
ALTER TABLE "VentaProducto" ALTER COLUMN "precioVenta" SET DATA TYPE DECIMAL(12,4);

-- CreateTable
CREATE TABLE "FormatoPresentacion" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoPresentacion" NOT NULL,
    "unidadContenido" "UnidadMedida" NOT NULL,
    "contenido" DECIMAL(12,4) NOT NULL,

    CONSTRAINT "FormatoPresentacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductoSKU" (
    "id" SERIAL NOT NULL,
    "productoId" INTEGER NOT NULL,
    "formatoId" INTEGER NOT NULL,
    "nombreSKU" TEXT NOT NULL,
    "sku" TEXT,
    "codigoBarras" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "factorConversionBase" DECIMAL(12,6) NOT NULL,
    "precioCostoActual" DECIMAL(12,4),
    "esDefaultVenta" BOOLEAN NOT NULL DEFAULT false,
    "esDefaultCompra" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductoSKU_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FormatoPresentacion_tipo_unidadContenido_contenido_key" ON "FormatoPresentacion"("tipo", "unidadContenido", "contenido");

-- CreateIndex
CREATE UNIQUE INDEX "ProductoSKU_codigoBarras_key" ON "ProductoSKU"("codigoBarras");

-- CreateIndex
CREATE INDEX "ProductoSKU_productoId_idx" ON "ProductoSKU"("productoId");

-- CreateIndex
CREATE INDEX "ProductoSKU_formatoId_idx" ON "ProductoSKU"("formatoId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductoSKU_productoId_formatoId_key" ON "ProductoSKU"("productoId", "formatoId");

-- CreateIndex
CREATE INDEX "HistorialStock_productoSkuId_fechaCambio_idx" ON "HistorialStock"("productoSkuId", "fechaCambio");

-- CreateIndex
CREATE INDEX "HistorialStock_sucursalId_fechaCambio_idx" ON "HistorialStock"("sucursalId", "fechaCambio");

-- CreateIndex
CREATE INDEX "PrecioProducto_productoId_idx" ON "PrecioProducto"("productoId");

-- CreateIndex
CREATE INDEX "PrecioProducto_productoSkuId_idx" ON "PrecioProducto"("productoSkuId");

-- CreateIndex
CREATE INDEX "PrecioProducto_rol_tipo_idx" ON "PrecioProducto"("rol", "tipo");

-- CreateIndex
CREATE INDEX "PrecioProducto_estado_idx" ON "PrecioProducto"("estado");

-- CreateIndex
CREATE INDEX "RequisicionLinea_productoSkuId_idx" ON "RequisicionLinea"("productoSkuId");

-- CreateIndex
CREATE INDEX "RequisicionLinea_productoId_idx" ON "RequisicionLinea"("productoId");

-- CreateIndex
CREATE INDEX "Stock_productoSkuId_sucursalId_idx" ON "Stock"("productoSkuId", "sucursalId");

-- CreateIndex
CREATE INDEX "Stock_productoSkuId_fechaIngreso_idx" ON "Stock"("productoSkuId", "fechaIngreso");

-- CreateIndex
CREATE INDEX "Stock_sucursalId_fechaVencimiento_idx" ON "Stock"("sucursalId", "fechaVencimiento");

-- AddForeignKey
ALTER TABLE "PrecioProducto" ADD CONSTRAINT "PrecioProducto_productoSkuId_fkey" FOREIGN KEY ("productoSkuId") REFERENCES "ProductoSKU"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoSKU" ADD CONSTRAINT "ProductoSKU_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoSKU" ADD CONSTRAINT "ProductoSKU_formatoId_fkey" FOREIGN KEY ("formatoId") REFERENCES "FormatoPresentacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stock" ADD CONSTRAINT "Stock_productoSkuId_fkey" FOREIGN KEY ("productoSkuId") REFERENCES "ProductoSKU"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistorialStock" ADD CONSTRAINT "HistorialStock_productoSkuId_fkey" FOREIGN KEY ("productoSkuId") REFERENCES "ProductoSKU"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistorialStock" ADD CONSTRAINT "HistorialStock_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequisicionLinea" ADD CONSTRAINT "RequisicionLinea_productoSkuId_fkey" FOREIGN KEY ("productoSkuId") REFERENCES "ProductoSKU"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
