import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { CreatePriceRequestDto } from './dto/create-price-request.dto';
import { UpdatePriceRequestDto } from './dto/update-price-request.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationService } from 'src/notification/notification.service';
import { LegacyGateway } from 'src/web-sockets/websocket.gateway';
import { nuevaSolicitud } from 'src/web-sockets/Types/SolicitudType';

@Injectable()
export class PriceRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly ws: LegacyGateway,
  ) {}
  //
  async create(createPriceRequestDto: CreatePriceRequestDto) {
    try {
      // 1) Crear solicitud
      const nueva = await this.prisma.solicitudPrecio.create({
        data: {
          precioSolicitado: createPriceRequestDto.precioSolicitado,
          aprobadoPorId: createPriceRequestDto.aprobadoPorId,
          productoId: createPriceRequestDto.productoId,
          estado: 'PENDIENTE',
          solicitadoPorId: createPriceRequestDto.solicitadoPorId,
        },
        include: {
          producto: { select: { id: true, nombre: true } },
          solicitadoPor: {
            select: {
              id: true,
              nombre: true,
              rol: true,
              sucursalId: true,
              sucursal: { select: { id: true, nombre: true } },
            },
          },
        },
      });

      // 2) Destinatarios: admins de la sucursal del solicitante
      const adminsSucursal = await this.prisma.usuario.findMany({
        where: {
          rol: 'ADMIN',
          sucursalId: nueva.solicitadoPor.sucursalId,
          activo: true,
        },
        select: { id: true },
      });
      let userIds = adminsSucursal.map((a) => a.id);

      // Fallback opcional a admins globales si no hay en sucursal
      if (userIds.length === 0) {
        const adminsGlobal = await this.prisma.usuario.findMany({
          where: { rol: 'ADMIN', activo: true },
          select: { id: true },
        });
        userIds = adminsGlobal.map((a) => a.id);
      }

      // 3) Notificación estandarizada
      await this.notificationService.createForUsers({
        userIds,
        titulo: 'Nueva solicitud de precio',
        mensaje: `El vendedor ${nueva.solicitadoPor.nombre} pide Q${nueva.precioSolicitado} para "${nueva.producto.nombre}".`,
        categoria: 'VENTAS',
        severidad: 'INFORMACION',
        subtipo: 'PRICE_REQUEST_CREATED',
        route: `/solicitudes-precio/${nueva.id}`,
        referenciaTipo: 'SolicitudPrecio',
        referenciaId: nueva.id,
        remitenteId: nueva.solicitadoPor.id,
        sucursalId: nueva.solicitadoPor.sucursalId,
        actionLabel: 'Revisar solicitud',
        meta: {
          solicitudId: nueva.id,
          precioSolicitado: nueva.precioSolicitado,
          producto: { id: nueva.producto.id, nombre: nueva.producto.nombre },
          solicitante: {
            id: nueva.solicitadoPor.id,
            nombre: nueva.solicitadoPor.nombre,
            rol: nueva.solicitadoPor.rol,
          },
          sucursal: {
            id:
              nueva.solicitadoPor.sucursal?.id ??
              nueva.solicitadoPor.sucursalId,
            nombre: nueva.solicitadoPor.sucursal?.nombre ?? null,
          },
        },
      });
      const newSolicitud = await this.prisma.solicitudPrecio.findUnique({
        where: { id: nueva.id },
      });
      const nuevaSolicitud: nuevaSolicitud = {
        aprobadoPorId: newSolicitud.aprobadoPorId,
        estado: newSolicitud.estado,
        fechaRespuesta: newSolicitud.fechaRespuesta,
        fechaSolicitud: newSolicitud.fechaSolicitud,
        id: newSolicitud.id,
        precioSolicitado: newSolicitud.precioSolicitado,
        productoId: newSolicitud.productoId,
        solicitadoPorId: newSolicitud.solicitadoPorId,
      };
      // 4) Emitir evento de dominio para actualizar la lista en vivo
      for (const admin of userIds) {
        this.ws.handleEnviarSolicitudPrecio(nuevaSolicitud, admin);
      }

      return nueva;
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException(
        'Error al crear registro y enviar notificaciones',
      );
    }
  }

  async aceptPriceRequest(idSolicitud: number, idUser: number) {
    try {
      // 1) Cargar y validar
      const solicitud = await this.prisma.solicitudPrecio.findFirst({
        where: { id: idSolicitud, estado: 'PENDIENTE' },
        include: {
          producto: { select: { id: true, nombre: true } },
          solicitadoPor: {
            select: { id: true, nombre: true, sucursalId: true },
          },
        },
      });
      if (!solicitud)
        throw new BadRequestException('Solicitud no encontrada o ya procesada');

      // 2) Aprobar + crear precio (DB)
      const solicitudAprobada = await this.prisma.solicitudPrecio.update({
        where: { id: idSolicitud },
        data: {
          estado: 'APROBADO',
          fechaRespuesta: new Date(),
          aprobadoPorId: idUser,
        },
      });

      const maxOrden = await this.prisma.precioProducto.aggregate({
        where: { productoId: solicitud.producto.id },
        _max: { orden: true },
      });

      const nuevoPrecio = await this.prisma.precioProducto.create({
        data: {
          estado: 'APROBADO',
          precio: solicitudAprobada.precioSolicitado,
          creadoPorId: idUser,
          productoId: solicitud.producto.id,
          tipo: 'CREADO_POR_SOLICITUD',
          orden: (maxOrden._max.orden || 0) + 1,
          usado: false,
          rol: 'PUBLICO',
        },
      });

      // 3) Notificar al solicitante (estándar)
      await this.notificationService.createOne({
        userId: solicitud.solicitadoPor.id,
        titulo: 'Solicitud de precio aprobada',
        mensaje: `Se aprobó tu solicitud para "${solicitud.producto.nombre}" por Q${solicitudAprobada.precioSolicitado}.`,
        categoria: 'VENTAS',
        severidad: 'EXITO',
        subtipo: 'PRICE_REQUEST_APPROVED',
        route: `/solicitudes-precio/${solicitud.id}`,
        referenciaTipo: 'SolicitudPrecio',
        referenciaId: solicitud.id,
        remitenteId: idUser,
        sucursalId: solicitud.solicitadoPor.sucursalId,
        actionLabel: 'Ver detalle',
        meta: {
          solicitudId: solicitud.id,
          producto: {
            id: solicitud.producto.id,
            nombre: solicitud.producto.nombre,
          },
          precioAprobado: solicitudAprobada.precioSolicitado,
          precioProductoId: nuevoPrecio.id,
        },
      });

      return { solicitudAprobada, nuevoPrecio };
    } catch (error) {
      console.error(error);
      throw new BadRequestException('Error al procesar la solicitud de precio');
    }
  }

  async rejectRequesPrice(
    idSolicitud: number,
    idUser: number,
    motivo?: string,
  ) {
    try {
      // 1) Carga lo necesario para notificación
      const solicitud = await this.prisma.solicitudPrecio.findUnique({
        where: { id: idSolicitud },
        include: {
          producto: { select: { id: true, nombre: true } },
          solicitadoPor: {
            select: { id: true, nombre: true, sucursalId: true },
          },
        },
      });
      if (!solicitud) throw new BadRequestException('Solicitud no encontrada');

      // 2) Borra la solicitud (si tu flujo así lo requiere)
      await this.prisma.solicitudPrecio.delete({ where: { id: idSolicitud } });

      // 3) Notifica al solicitante (no referencies el borrado)
      await this.notificationService.createOne({
        userId: solicitud.solicitadoPor.id,
        titulo: 'Solicitud de precio rechazada',
        mensaje: `Se rechazó tu solicitud para "${solicitud.producto.nombre}".${motivo ? ' Motivo: ' + motivo : ''}`,
        categoria: 'VENTAS',
        severidad: 'ALERTA',
        subtipo: 'PRICE_REQUEST_REJECTED',
        route: `/solicitudes-precio`, // vista general (o al producto)
        referenciaTipo: null, // recurso eliminado
        referenciaId: null,
        remitenteId: idUser,
        sucursalId: solicitud.solicitadoPor.sucursalId,
        actionLabel: 'Ver solicitudes',
        meta: {
          solicitudId: idSolicitud,
          producto: {
            id: solicitud.producto.id,
            nombre: solicitud.producto.nombre,
          },
          motivo: motivo ?? null,
        },
      });

      return solicitud;
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Error al rechazar la solicitud');
    }
  }

  async findAll() {
    try {
      const solicitudesDePrecio = await this.prisma.solicitudPrecio.findMany({
        where: {
          estado: 'PENDIENTE',
          aprobadoPor: null,
          fechaRespuesta: null,
        },
        include: {
          producto: true,
          solicitadoPor: {
            select: {
              nombre: true,
              id: true,
              rol: true,
              sucursal: {
                select: {
                  nombre: true,
                },
              },
            },
          },
        },
      });
      return solicitudesDePrecio;
    } catch (error) {
      console.log(error);
      throw new BadRequestException('Err');
    }
  }

  findOne(id: number) {
    return `This action returns a #${id} priceRequest`;
  }

  update(id: number, updatePriceRequestDto: UpdatePriceRequestDto) {
    return `This action updates a #${id} priceRequest`;
  }

  remove(id: number) {
    return `This action removes a #${id} priceRequest`;
  }

  async allremove() {
    return await this.prisma.solicitudPrecio.deleteMany({});
  }
}
