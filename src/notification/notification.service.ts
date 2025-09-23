import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { LegacyGateway } from 'src/web-sockets/websocket.gateway';
import { Prisma, TipoNotificacion } from '@prisma/client';
import { NotificationToEmit } from 'src/web-sockets/Types/NotificationTypeSocket';
import { nuevaSolicitud } from 'src/web-sockets/Types/SolicitudType';

@Injectable()
export class NotificationService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly webSocketService: LegacyGateway,
  ) {}
  //CREAR NOTIFICACION SIMPLE

  async create(
    mensaje: string,
    remitenteId: number,
    usuarioIds: number[], // ahora aceptamos un array de IDs de usuarios
    tipoNotificacion: TipoNotificacion,
    referenciaId?: number | null,
  ) {
    try {
      const nuevaNotificacion = await this.prismaService.notificacion.create({
        data: {
          mensaje,
          remitenteId,
          tipoNotificacion,
          referenciaId,
        },
      });

      // Creamos las notificaciones para todos los usuarios
      const notificationsForUsers = usuarioIds.map((usuarioId) => ({
        usuarioId,
        notificacionId: nuevaNotificacion.id,
        leido: false,
        eliminado: false,
      }));

      const notificacionesParaUsuarios =
        await this.prismaService.notificacionesUsuarios.createMany({
          data: notificationsForUsers,
        });

      console.log(
        'Los nuevos registros de notificaciones son: ',
        notificacionesParaUsuarios,
      );

      // Crear la notificación para emitir
      const notificationToEmit: NotificationToEmit = {
        id: nuevaNotificacion.id,
        mensaje: nuevaNotificacion.mensaje,
        remitenteId: nuevaNotificacion.remitenteId,
        tipoNotificacion: nuevaNotificacion.tipoNotificacion,
        referenciaId: referenciaId ?? null,
        fechaCreacion: nuevaNotificacion.fechaCreacion.toISOString(),
      };

      // Emitir la notificación a cada usuario
      usuarioIds.forEach((usuarioId) => {
        this.webSocketService.handleEnviarNotificacion(
          notificationToEmit,
          usuarioId,
        );
      });

      return nuevaNotificacion;
    } catch (error) {
      console.log(error);
      throw new BadRequestException('Error al crear notificación');
    }
  }

  async createOneNotification(
    mensaje: string,
    remitenteId: number | null,
    usuarioId: number, // el ID del usuario receptor
    tipoNotificacion: TipoNotificacion,
    referenciaId?: number | null,
    tx?: Prisma.TransactionClient, // <--- opcional
  ) {
    try {
      const prisma = tx ?? this.prismaService;

      const nuevaNotificacion = await prisma.notificacion.create({
        data: {
          mensaje,
          remitenteId: remitenteId !== 0 ? remitenteId : null,
          tipoNotificacion,
          referenciaId,
        },
      });

      await prisma.notificacionesUsuarios.create({
        data: {
          usuarioId,
          notificacionId: nuevaNotificacion.id,
          leido: false,
          eliminado: false,
        },
      });

      // Si tienes websockets puedes emitirlo después de confirmar la transacción,
      // o fuera del transaction para evitar errores.
      const notificationToEmit: NotificationToEmit = {
        id: nuevaNotificacion.id,
        mensaje: nuevaNotificacion.mensaje,
        remitenteId: nuevaNotificacion.remitenteId,
        tipoNotificacion: nuevaNotificacion.tipoNotificacion,
        referenciaId: referenciaId ?? null,
        fechaCreacion: nuevaNotificacion.fechaCreacion.toISOString(),
      };

      // Recomendado: solo emitir fuera de la transacción principal
      await this.webSocketService.handleEnviarNotificacion(
        notificationToEmit,
        usuarioId,
      );

      return nuevaNotificacion;
    } catch (error) {
      console.log(error);
      throw new BadRequestException('Error al crear notificación');
    }
  }

  async getMyNotifications(idUser: number) {
    try {
      const notificaciones =
        await this.prismaService.notificacionesUsuarios.findMany({
          where: {
            usuarioId: idUser,
            eliminado: false,
          },
          include: {
            notificacion: true,
          },
          orderBy: {
            recibidoEn: 'desc',
          },
        });

      // Mapear cada notificación al formato simplificado, construimos un array de objetos simples
      const notificacionesSimplificadas = notificaciones.map((n) => ({
        id: n.notificacion.id,
        mensaje: n.notificacion.mensaje,
        remitenteId: n.notificacion.remitenteId,
        tipoNotificacion: n.notificacion.tipoNotificacion,
        referenciaId: n.notificacion.referenciaId,
        fechaCreacion: n.notificacion.fechaCreacion,
      }));

      return notificacionesSimplificadas;
    } catch (error) {
      console.error('Error al obtener notificaciones:', error);
      throw new Error('No se pudo obtener las notificaciones.');
    }
  }

  async deleteNotification(notificacionId: number, usuarioId: number) {
    try {
      // Buscamos la relación en NotificacionesUsuarios
      const notificacionUsuario =
        await this.prismaService.notificacionesUsuarios.findFirst({
          where: {
            notificacionId,
            usuarioId,
          },
        });

      if (!notificacionUsuario) {
        throw new Error(
          `No se encontró la notificación con id ${notificacionId} para el usuario ${usuarioId}.`,
        );
      }

      // Procedemos a eliminar la relación
      await this.prismaService.notificacionesUsuarios.delete({
        where: {
          id: notificacionUsuario.id,
        },
      });

      return { message: 'Notificación eliminada correctamente.' };
    } catch (error) {
      console.error('Error al eliminar la notificación:', error);
      throw new InternalServerErrorException(
        'No se pudo eliminar la notificación.',
      );
    }
  }

  async enviarNotificarSolicitud(solicitud: nuevaSolicitud, userID: number) {
    try {
      await this.webSocketService.handleEnviarSolicitudPrecio(
        solicitud,
        userID,
      );
    } catch (error) {
      console.log(error);
      throw new BadRequestException('Error al enviar la solicitud');
    }
  }

  findAll() {
    return `This action returns all notification`;
  }

  findOne(id: number) {
    return `This action returns a #${id} notification`;
  }

  update(id: number, updateNotificationDto: UpdateNotificationDto) {
    return `This action updates a #${id} notification`;
  }

  async removeall() {
    const x = await this.prismaService.notificacionesUsuarios.deleteMany({});
    return await this.prismaService.notificacion.deleteMany({});
  }

  remove(id: number) {
    return `This action removes a #${id} notification`;
  }
}
