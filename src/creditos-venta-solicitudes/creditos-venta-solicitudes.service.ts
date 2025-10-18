import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { CreateCreditosVentaSolicitudeDto } from './dto/create-creditos-venta-solicitude.dto';
import { UpdateCreditosVentaSolicitudeDto } from './dto/update-creditos-venta-solicitude.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class CreditosVentaSolicitudesService {
  private readonly logger = new Logger(CreditosVentaSolicitudesService.name);
  constructor(private readonly prisma: PrismaService) {}
  create(createCreditosVentaSolicitudeDto: CreateCreditosVentaSolicitudeDto) {
    return 'This action adds a new creditosVentaSolicitude';
  }

  // aprobacion-credito.service.ts
  // async aprobarSolicitud(id: number, dto: AprobarSolicitudDto, aprobadorId: number) {
  //   return this.prisma.$transaction(async (tx) => {
  //     const solicitud = await tx.solicitudCreditoVenta.findUniqueOrThrow({
  //       where: { id },
  //       include: { lineas: true },
  //     });

  //     if (solicitud.estado !== 'PENDIENTE') {
  //       throw new ConflictException('Solicitud no está PENDIENTE');
  //     }

  //     // 1) Crear Venta
  //     const venta = await tx.venta.create({
  //       data: {
  //         sucursalId: solicitud.sucursalId,
  //         clienteId: solicitud.clienteId ?? null,
  //         nombreClienteFinal: solicitud.nombreCliente,
  //         telefonoClienteFinal: solicitud.telefonoCliente,
  //         direccionClienteFinal: solicitud.direccionCliente,
  //         totalVenta: solicitud.totalPropuesto,
  //         // metodoPago: CREDIT0? (si tu enum/metamodelo lo contempla)
  //         productos: {
  //           create: solicitud.lineas.map(l => ({
  //             productoId: l.productoId ?? undefined,
  //             presentacionId: l.presentacionId ?? undefined,
  //             cantidad: l.cantidad,
  //             precioUnitario: l.precioUnitario,
  //             subtotal: l.subtotal,
  //           })),
  //         },
  //       },
  //       include: { productos: true },
  //     });

  //     // 2) (Opcional) Crear VentaCuota + Cuotas
  //     const plan = /* mezcla dto + solicitud */;
  //     const ventaCuota = await tx.ventaCuota.create({
  //       data: {
  //         // si agregaste ventaId en el schema:
  //         // ventaId: venta.id,
  //         clienteId: solicitud.clienteId!,
  //         usuarioId: aprobadorId,
  //         sucursalId: solicitud.sucursalId,
  //         totalVenta: solicitud.totalPropuesto,
  //         cuotaInicial: plan.cuotaInicial ?? 0,
  //         cuotasTotales: plan.cuotasTotales,
  //         diasEntrePagos: plan.diasEntrePagos ?? 30,
  //         // …otros campos (interés, modo, etc.)
  //         cuotas: { create: generarCuotas(plan) }, // genera fechas/montos
  //       },
  //     });

  //     // 3) Movimiento de stock por venta (usa tu servicio existente)
  //     await this.stockService.descontarPorVentaTx(tx, { venta });

  //     // 4) Cerrar solicitud
  //     await tx.solicitudCreditoVenta.update({
  //       where: { id },
  //       data: {
  //         estado: 'APROBADO',
  //         ventaId: venta.id,
  //         aprobadoPorId: aprobadorId,
  //         fechaRespuesta: new Date(),
  //         historial: { create: {
  //           accion: 'APROBADA',
  //           actorId: aprobadorId,
  //           comentario: dto.comentario ?? null,
  //         }},
  //       },
  //     });

  //     // 5) Notificar al solicitante
  //     await this.notificacionesService.notificarResultadoCreditoTx(tx, {
  //       solicitudId: id, aprobado: true
  //     });

  //     return { ventaId: venta.id };
  //   });
  // }
}
