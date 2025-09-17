/*
  Warnings:

  - The values [AGROSERVICIO,FINCA] on the enum `RolPrecio` will be removed. If these variants are still used in the database, this will fail.
  - You are about to alter the column `total` on the `Compra` table. The data in that column could be lost. The data in that column will be cast from `Decimal(14,4)` to `DoublePrecision`.
  - You are about to alter the column `costoUnitario` on the `CompraDetalle` table. The data in that column could be lost. The data in that column will be cast from `Decimal(14,4)` to `DoublePrecision`.
  - You are about to alter the column `monto` on the `Cuota` table. The data in that column could be lost. The data in that column will be cast from `Decimal(14,4)` to `DoublePrecision`.
  - You are about to alter the column `montoEsperado` on the `Cuota` table. The data in that column could be lost. The data in that column will be cast from `Decimal(14,4)` to `DoublePrecision`.
  - You are about to alter the column `montoDepositado` on the `DepositoCobro` table. The data in that column could be lost. The data in that column will be cast from `Decimal(14,4)` to `DoublePrecision`.
  - You are about to alter the column `montoVenta` on the `DetalleResumenVenta` table. The data in that column could be lost. The data in that column will be cast from `Decimal(14,4)` to `DoublePrecision`.
  - You are about to alter the column `montoTotal` on the `EntregaStock` table. The data in that column could be lost. The data in that column will be cast from `Decimal(14,4)` to `DoublePrecision`.
  - You are about to alter the column `precioAnterior` on the `HistorialPrecio` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,4)` to `DoublePrecision`.
  - You are about to alter the column `precioNuevo` on the `HistorialPrecio` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,4)` to `DoublePrecision`.
  - You are about to alter the column `precioCostoAnterior` on the `HistorialPrecioCosto` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,4)` to `DoublePrecision`.
  - You are about to alter the column `precioCostoNuevo` on the `HistorialPrecioCosto` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,4)` to `DoublePrecision`.
  - You are about to drop the column `productoSkuId` on the `HistorialStock` table. All the data in the column will be lost.
  - You are about to drop the column `stockId` on the `HistorialStock` table. All the data in the column will be lost.
  - You are about to alter the column `montoMeta` on the `MetaCobros` table. The data in that column could be lost. The data in that column will be cast from `Decimal(14,4)` to `DoublePrecision`.
  - You are about to alter the column `montoActual` on the `MetaCobros` table. The data in that column could be lost. The data in that column will be cast from `Decimal(14,4)` to `DoublePrecision`.
  - You are about to alter the column `montoMeta` on the `MetaUsuario` table. The data in that column could be lost. The data in that column will be cast from `Decimal(14,4)` to `DoublePrecision`.
  - You are about to alter the column `montoActual` on the `MetaUsuario` table. The data in that column could be lost. The data in that column will be cast from `Decimal(14,4)` to `DoublePrecision`.
  - You are about to alter the column `numeroVentas` on the `MetaUsuario` table. The data in that column could be lost. The data in that column will be cast from `Decimal(14,4)` to `DoublePrecision`.
  - You are about to alter the column `monto` on the `Pago` table. The data in that column could be lost. The data in that column will be cast from `Decimal(14,4)` to `DoublePrecision`.
  - You are about to alter the column `totalPedido` on the `Pedido` table. The data in that column could be lost. The data in that column will be cast from `Decimal(14,4)` to `DoublePrecision`.
  - You are about to alter the column `precioUnitario` on the `PedidoLinea` table. The data in that column could be lost. The data in that column will be cast from `Decimal(14,4)` to `DoublePrecision`.
  - You are about to alter the column `subtotal` on the `PedidoLinea` table. The data in that column could be lost. The data in that column will be cast from `Decimal(14,4)` to `DoublePrecision`.
  - You are about to drop the column `productoSkuId` on the `PrecioProducto` table. All the data in the column will be lost.
  - You are about to alter the column `precio` on the `PrecioProducto` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,4)` to `DoublePrecision`.
  - You are about to drop the column `unidadBase` on the `Producto` table. All the data in the column will be lost.
  - You are about to alter the column `precioCostoActual` on the `Producto` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,4)` to `DoublePrecision`.
  - You are about to drop the column `productoSkuId` on the `RequisicionLinea` table. All the data in the column will be lost.
  - You are about to alter the column `precioUnitario` on the `RequisicionLinea` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,4)` to `DoublePrecision`.
  - You are about to alter the column `totalVentas` on the `ResumenVenta` table. The data in that column could be lost. The data in that column will be cast from `Decimal(14,4)` to `DoublePrecision`.
  - You are about to alter the column `ticketPromedio` on the `ResumenVenta` table. The data in that column could be lost. The data in that column will be cast from `Decimal(14,4)` to `DoublePrecision`.
  - You are about to alter the column `precioSolicitado` on the `SolicitudPrecio` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,4)` to `DoublePrecision`.
  - You are about to drop the column `fabricadoEn` on the `Stock` table. All the data in the column will be lost.
  - You are about to drop the column `loteCodigo` on the `Stock` table. All the data in the column will be lost.
  - You are about to drop the column `productoSkuId` on the `Stock` table. All the data in the column will be lost.
  - You are about to alter the column `costoTotal` on the `Stock` table. The data in that column could be lost. The data in that column will be cast from `Decimal(14,4)` to `DoublePrecision`.
  - You are about to alter the column `precioCosto` on the `Stock` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,4)` to `DoublePrecision`.
  - You are about to alter the column `totalVenta` on the `Venta` table. The data in that column could be lost. The data in that column will be cast from `Decimal(14,4)` to `DoublePrecision`.
  - You are about to alter the column `totalVenta` on the `VentaCuota` table. The data in that column could be lost. The data in that column will be cast from `Decimal(14,4)` to `DoublePrecision`.
  - You are about to alter the column `cuotaInicial` on the `VentaCuota` table. The data in that column could be lost. The data in that column will be cast from `Decimal(14,4)` to `DoublePrecision`.
  - You are about to alter the column `montoVenta` on the `VentaCuota` table. The data in that column could be lost. The data in that column will be cast from `Decimal(14,4)` to `DoublePrecision`.
  - You are about to alter the column `totalPagado` on the `VentaCuota` table. The data in that column could be lost. The data in that column will be cast from `Decimal(14,4)` to `DoublePrecision`.
  - You are about to alter the column `totalVenta` on the `VentaEliminada` table. The data in that column could be lost. The data in that column will be cast from `Decimal(14,4)` to `DoublePrecision`.
  - You are about to alter the column `precioVenta` on the `VentaEliminadaProducto` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,4)` to `DoublePrecision`.
  - You are about to alter the column `precioVenta` on the `VentaProducto` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,4)` to `DoublePrecision`.
  - You are about to drop the `FormatoPresentacion` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProductoSKU` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `productoId` to the `Stock` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "RolPrecio_new" AS ENUM ('PUBLICO', 'MAYORISTA', 'ESPECIAL', 'DISTRIBUIDOR', 'PROMOCION', 'CLIENTE_ESPECIAL');
ALTER TABLE "PrecioProducto" ALTER COLUMN "rol" TYPE "RolPrecio_new" USING ("rol"::text::"RolPrecio_new");
ALTER TYPE "RolPrecio" RENAME TO "RolPrecio_old";
ALTER TYPE "RolPrecio_new" RENAME TO "RolPrecio";
DROP TYPE "RolPrecio_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "HistorialStock" DROP CONSTRAINT "HistorialStock_productoSkuId_fkey";

-- DropForeignKey
ALTER TABLE "HistorialStock" DROP CONSTRAINT "HistorialStock_stockId_fkey";

-- DropForeignKey
ALTER TABLE "PrecioProducto" DROP CONSTRAINT "PrecioProducto_productoSkuId_fkey";

-- DropForeignKey
ALTER TABLE "ProductoSKU" DROP CONSTRAINT "ProductoSKU_formatoId_fkey";

-- DropForeignKey
ALTER TABLE "ProductoSKU" DROP CONSTRAINT "ProductoSKU_productoId_fkey";

-- DropForeignKey
ALTER TABLE "RequisicionLinea" DROP CONSTRAINT "RequisicionLinea_productoSkuId_fkey";

-- DropForeignKey
ALTER TABLE "Stock" DROP CONSTRAINT "Stock_productoSkuId_fkey";

-- DropIndex
DROP INDEX "HistorialStock_productoSkuId_fechaCambio_idx";

-- DropIndex
DROP INDEX "HistorialStock_sucursalId_fechaCambio_idx";

-- DropIndex
DROP INDEX "PrecioProducto_estado_idx";

-- DropIndex
DROP INDEX "PrecioProducto_productoId_idx";

-- DropIndex
DROP INDEX "PrecioProducto_productoSkuId_idx";

-- DropIndex
DROP INDEX "PrecioProducto_rol_tipo_idx";

-- DropIndex
DROP INDEX "RequisicionLinea_productoId_idx";

-- DropIndex
DROP INDEX "RequisicionLinea_productoSkuId_idx";

-- DropIndex
DROP INDEX "Stock_productoSkuId_fechaIngreso_idx";

-- DropIndex
DROP INDEX "Stock_productoSkuId_sucursalId_idx";

-- DropIndex
DROP INDEX "Stock_sucursalId_fechaVencimiento_idx";

-- AlterTable
ALTER TABLE "Compra" ALTER COLUMN "total" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "CompraDetalle" ALTER COLUMN "costoUnitario" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Cuota" ALTER COLUMN "monto" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "montoEsperado" DROP NOT NULL,
ALTER COLUMN "montoEsperado" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "DepositoCobro" ALTER COLUMN "montoDepositado" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "DetalleResumenVenta" ALTER COLUMN "montoVenta" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "EntregaStock" ALTER COLUMN "montoTotal" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "HistorialPrecio" ALTER COLUMN "precioAnterior" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "precioNuevo" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "HistorialPrecioCosto" ALTER COLUMN "precioCostoAnterior" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "precioCostoNuevo" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "HistorialStock" DROP COLUMN "productoSkuId",
DROP COLUMN "stockId",
ADD COLUMN     "productoId" INTEGER;

-- AlterTable
ALTER TABLE "MetaCobros" ALTER COLUMN "montoMeta" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "montoActual" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "MetaUsuario" ALTER COLUMN "montoMeta" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "montoActual" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "numeroVentas" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Pago" ALTER COLUMN "monto" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Pedido" ALTER COLUMN "totalPedido" DROP NOT NULL,
ALTER COLUMN "totalPedido" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "PedidoLinea" ALTER COLUMN "precioUnitario" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "subtotal" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "PrecioProducto" DROP COLUMN "productoSkuId",
ALTER COLUMN "precio" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Producto" DROP COLUMN "unidadBase",
ALTER COLUMN "precioCostoActual" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "RequisicionLinea" DROP COLUMN "productoSkuId",
ALTER COLUMN "precioUnitario" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "ResumenVenta" ALTER COLUMN "totalVentas" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "ticketPromedio" DROP NOT NULL,
ALTER COLUMN "ticketPromedio" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "SolicitudPrecio" ALTER COLUMN "precioSolicitado" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Stock" DROP COLUMN "fabricadoEn",
DROP COLUMN "loteCodigo",
DROP COLUMN "productoSkuId",
ADD COLUMN     "productoId" INTEGER NOT NULL,
ALTER COLUMN "costoTotal" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "precioCosto" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "actualizadoEn" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Venta" ALTER COLUMN "totalVenta" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "VentaCuota" ALTER COLUMN "totalVenta" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "cuotaInicial" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "montoVenta" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "totalPagado" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "VentaEliminada" ALTER COLUMN "totalVenta" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "VentaEliminadaProducto" ALTER COLUMN "precioVenta" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "VentaProducto" ALTER COLUMN "precioVenta" SET DATA TYPE DOUBLE PRECISION;

-- DropTable
DROP TABLE "FormatoPresentacion";

-- DropTable
DROP TABLE "ProductoSKU";

-- DropEnum
DROP TYPE "TipoPresentacion";

-- DropEnum
DROP TYPE "UnidadMedida";

-- AddForeignKey
ALTER TABLE "Stock" ADD CONSTRAINT "Stock_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistorialStock" ADD CONSTRAINT "HistorialStock_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
