-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoMovimientoStock" ADD VALUE 'AJUSTE_STOCK';
ALTER TYPE "TipoMovimientoStock" ADD VALUE 'ELIMINACION_VENTA';
ALTER TYPE "TipoMovimientoStock" ADD VALUE 'TRANSFERENCIA';
ALTER TYPE "TipoMovimientoStock" ADD VALUE 'ENTREGA_STOCK';
