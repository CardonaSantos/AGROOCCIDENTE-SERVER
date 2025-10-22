-- AddForeignKey
ALTER TABLE "SolicitudCreditoVentaLinea" ADD CONSTRAINT "SolicitudCreditoVentaLinea_precioSeleccionadoId_fkey" FOREIGN KEY ("precioSeleccionadoId") REFERENCES "PrecioProducto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
