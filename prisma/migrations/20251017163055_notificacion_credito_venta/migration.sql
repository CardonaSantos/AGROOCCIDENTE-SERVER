-- CreateEnum
CREATE TYPE "AccionSolicitudCredito" AS ENUM ('CREADA', 'EDITADA', 'APROBADA', 'RECHAZADA', 'CANCELADA');

-- AlterEnum
ALTER TYPE "TipoNotificacion" ADD VALUE 'CREDITO_VENTA';

-- CreateTable
CREATE TABLE "SolicitudCreditoVenta" (
    "id" SERIAL NOT NULL,
    "sucursalId" INTEGER NOT NULL,
    "clienteId" INTEGER,
    "nombreCliente" TEXT,
    "telefonoCliente" TEXT,
    "direccionCliente" TEXT,
    "totalPropuesto" DOUBLE PRECISION NOT NULL,
    "cuotaInicialPropuesta" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cuotasTotalesPropuestas" INTEGER NOT NULL,
    "interesTipo" "InteresTipo" NOT NULL DEFAULT 'NONE',
    "interesPorcentaje" INTEGER NOT NULL DEFAULT 0,
    "planCuotaModo" "PlanCuotaModo" NOT NULL DEFAULT 'IGUALES',
    "diasEntrePagos" INTEGER NOT NULL DEFAULT 30,
    "fechaPrimeraCuota" TIMESTAMP(3),
    "comentario" TEXT,
    "garantiaMeses" INTEGER NOT NULL DEFAULT 0,
    "testigos" JSONB,
    "estado" "EstadoSolicitud" NOT NULL DEFAULT 'PENDIENTE',
    "solicitadoPorId" INTEGER,
    "aprobadoPorId" INTEGER,
    "fechaSolicitud" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaRespuesta" TIMESTAMP(3),
    "motivoRechazo" TEXT,
    "ventaId" INTEGER,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SolicitudCreditoVenta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolicitudCreditoVentaLinea" (
    "id" SERIAL NOT NULL,
    "solicitudId" INTEGER NOT NULL,
    "productoId" INTEGER,
    "presentacionId" INTEGER,
    "cantidad" INTEGER NOT NULL,
    "precioUnitario" DOUBLE PRECISION NOT NULL,
    "precioListaRef" DOUBLE PRECISION,
    "descuento" DOUBLE PRECISION,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "nombreProductoSnapshot" TEXT,
    "presentacionNombreSnapshot" TEXT,
    "codigoBarrasSnapshot" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SolicitudCreditoVentaLinea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolicitudCreditoVentaHistorial" (
    "id" SERIAL NOT NULL,
    "solicitudId" INTEGER NOT NULL,
    "accion" "AccionSolicitudCredito" NOT NULL,
    "comentario" TEXT,
    "actorId" INTEGER,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SolicitudCreditoVentaHistorial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SolicitudCreditoVenta_ventaId_key" ON "SolicitudCreditoVenta"("ventaId");

-- CreateIndex
CREATE INDEX "SolicitudCreditoVenta_estado_sucursalId_fechaSolicitud_idx" ON "SolicitudCreditoVenta"("estado", "sucursalId", "fechaSolicitud");

-- CreateIndex
CREATE INDEX "SolicitudCreditoVenta_solicitadoPorId_idx" ON "SolicitudCreditoVenta"("solicitadoPorId");

-- CreateIndex
CREATE INDEX "SolicitudCreditoVentaLinea_solicitudId_idx" ON "SolicitudCreditoVentaLinea"("solicitudId");

-- CreateIndex
CREATE INDEX "SolicitudCreditoVentaHistorial_solicitudId_fecha_idx" ON "SolicitudCreditoVentaHistorial"("solicitudId", "fecha");

-- AddForeignKey
ALTER TABLE "SolicitudCreditoVenta" ADD CONSTRAINT "SolicitudCreditoVenta_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudCreditoVenta" ADD CONSTRAINT "SolicitudCreditoVenta_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudCreditoVenta" ADD CONSTRAINT "SolicitudCreditoVenta_solicitadoPorId_fkey" FOREIGN KEY ("solicitadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudCreditoVenta" ADD CONSTRAINT "SolicitudCreditoVenta_aprobadoPorId_fkey" FOREIGN KEY ("aprobadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudCreditoVenta" ADD CONSTRAINT "SolicitudCreditoVenta_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudCreditoVentaLinea" ADD CONSTRAINT "SolicitudCreditoVentaLinea_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "SolicitudCreditoVenta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudCreditoVentaLinea" ADD CONSTRAINT "SolicitudCreditoVentaLinea_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudCreditoVentaLinea" ADD CONSTRAINT "SolicitudCreditoVentaLinea_presentacionId_fkey" FOREIGN KEY ("presentacionId") REFERENCES "ProductoPresentacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudCreditoVentaHistorial" ADD CONSTRAINT "SolicitudCreditoVentaHistorial_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "SolicitudCreditoVenta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudCreditoVentaHistorial" ADD CONSTRAINT "SolicitudCreditoVentaHistorial_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
