-- CreateEnum
CREATE TYPE "TipoEmpaque" AS ENUM ('CUBETA', 'BIDON', 'TAMBOR', 'BLISTER', 'UNIDAD', 'BOTELLA', 'CAJA', 'PACK', 'SACO');

-- AlterTable
ALTER TABLE "ProductoPresentacion" ADD COLUMN     "costoReferencialPresentacion" DECIMAL(12,4),
ADD COLUMN     "tipoPresentacion" "TipoEmpaque" NOT NULL DEFAULT 'UNIDAD';
