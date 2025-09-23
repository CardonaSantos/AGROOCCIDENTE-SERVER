import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { CreateSolicitudTransferenciaProductoDto } from './dto/create-solicitud-transferencia-producto.dto';
import { UpdateSolicitudTransferenciaProductoDto } from './dto/update-solicitud-transferencia-producto.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationService } from 'src/notification/notification.service';
import { LegacyGateway } from 'src/web-sockets/websocket.gateway';
import { CreateTransferenciaProductoDto } from 'src/transferencia-producto/dto/create-transferencia-producto.dto';
import { HistorialStockTrackerService } from 'src/historial-stock-tracker/historial-stock-tracker.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class SolicitudTransferenciaProductoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly webSocketGateway: LegacyGateway,
    private readonly tracker: HistorialStockTrackerService,
  ) {}

  async create(
    createSolicitudTransferenciaProductoDto: CreateSolicitudTransferenciaProductoDto,
  ) {
    try {
      const nuevaSolicitudTransferencia =
        await this.prisma.solicitudTransferenciaProducto.create({
          data: {
            cantidad: createSolicitudTransferenciaProductoDto.cantidad,
            estado: 'PENDIENTE',
            productoId: createSolicitudTransferenciaProductoDto.productoId,
            sucursalOrigenId:
              createSolicitudTransferenciaProductoDto.sucursalOrigenId,
            sucursalDestinoId:
              createSolicitudTransferenciaProductoDto.sucursalDestinoId,
            usuarioSolicitanteId:
              createSolicitudTransferenciaProductoDto.usuarioSolicitanteId,
          },
        });

      const admins = await this.prisma.usuario.findMany({
        where: { rol: 'ADMIN' },
      });

      const user = await this.prisma.usuario.findUnique({
        where: {
          id: createSolicitudTransferenciaProductoDto.usuarioSolicitanteId,
        },
      });
      const product = await this.prisma.producto.findUnique({
        where: {
          id: createSolicitudTransferenciaProductoDto.productoId,
        },
      });

      const sucursalOrigen = await this.prisma.sucursal.findUnique({
        where: {
          id: createSolicitudTransferenciaProductoDto.sucursalOrigenId,
        },
      });

      const sucursalDestino = await this.prisma.sucursal.findUnique({
        where: {
          id: createSolicitudTransferenciaProductoDto.sucursalDestinoId,
        },
      });

      // const mensaje = `El usuario ${user.nombre} ha solicitdado una transferncia para el producto ${product.nombre} de la sucursal ${sucursalOrigen.nombre} a ${sucursalDestino.nombre}`;
      // const mensaje = `El usuario ${user.nombre} ha solicitado una transferencia del producto "${product.nombre}" desde la sucursal "${sucursalOrigen.nombre}" hacia la sucursal "${sucursalDestino.nombre} de ${createSolicitudTransferenciaProductoDto.cantidad} unidades".`;
      const mensaje = `El usuario ${user.nombre} ha solicitado una transferencia del producto "${product.nombre}" desde la sucursal "${sucursalOrigen.nombre}" hacia la sucursal "${sucursalDestino.nombre}" de un total de ${createSolicitudTransferenciaProductoDto.cantidad} unidades.`;

      const solicitudTranferenciaDetalles =
        await this.prisma.solicitudTransferenciaProducto.findUnique({
          where: {
            id: nuevaSolicitudTransferencia.id,
          },
          include: {
            producto: {
              select: {
                nombre: true,
              },
            },
            sucursalOrigen: {
              select: {
                nombre: true,
              },
            },
            sucursalDestino: {
              select: {
                nombre: true,
              },
            },
            usuarioSolicitante: {
              select: {
                nombre: true,
                rol: true,
              },
            },
          },
        });

      // Crear la notificación en la base de datos y emitir a cada administrador
      await Promise.all(
        admins.map(async (admin) => {
          // Crear y emitir notificación
          await this.notificationService.create(
            mensaje,
            createSolicitudTransferenciaProductoDto.usuarioSolicitanteId,
            [admin.id],
            'TRANSFERENCIA',
            solicitudTranferenciaDetalles.id,
          );

          // Emitir la solicitud de transferencia directamente a cada admin conectado
          this.webSocketGateway.handleEnviarSolicitudTransferencia(
            solicitudTranferenciaDetalles,
            admin.id,
          );
        }),
      );

      return nuevaSolicitudTransferencia;
    } catch (error) {
      console.log(error);
      throw new BadRequestException(
        'Error al crear la solicitud de transferencia',
      );
    }
  }

  // async createTransferencia(idSolicitudTransferencia: number, userID: number) {
  //   try {
  //     // Encontrar la solicitud de transferencia
  //     const solicitudTransferencia =
  //       await this.prisma.solicitudTransferenciaProducto.findUnique({
  //         where: { id: idSolicitudTransferencia },
  //       });

  //     if (!solicitudTransferencia) {
  //       throw new Error('Solicitud de transferencia no encontrada');
  //     }

  //     // Extraer datos necesarios para la transferencia
  //     const dto: CreateTransferenciaProductoDto = {
  //       productoId: solicitudTransferencia.productoId,
  //       cantidad: solicitudTransferencia.cantidad,
  //       sucursalOrigenId: solicitudTransferencia.sucursalOrigenId,
  //       sucursalDestinoId: solicitudTransferencia.sucursalDestinoId,
  //       usuarioEncargadoId: userID,
  //     };

  //     // Ejecutar la transferencia
  //     const transferencia = await this.transferirProducto(dto);

  //     // Eliminar la solicitud de transferencia después de completar la transferencia
  //     await this.prisma.solicitudTransferenciaProducto.delete({
  //       where: { id: idSolicitudTransferencia },
  //     });

  //     return {
  //       message: 'Transferencia realizada y solicitud eliminada con éxito',
  //       transferencia,
  //     };
  //   } catch (error) {
  //     throw new Error(`Error al aceptar la transferencia: ${error.message}`);
  //   }
  // }
  async createTransferencia(idSolicitudTransferencia: number, userID: number) {
    return await this.prisma.$transaction(async (tx) => {
      // 1. Buscar la solicitud de transferencia con sus datos clave
      const solicitudTransferencia =
        await tx.solicitudTransferenciaProducto.findUnique({
          where: { id: idSolicitudTransferencia },
          include: {
            producto: { select: { nombre: true } },
            sucursalOrigen: { select: { nombre: true } },
            sucursalDestino: { select: { nombre: true } },
            usuarioSolicitante: { select: { id: true, nombre: true } },
          },
        });

      if (!solicitudTransferencia) {
        throw new Error('Solicitud de transferencia no encontrada');
      }

      // DTO para usar en la función de transferencia
      const dto: CreateTransferenciaProductoDto = {
        productoId: solicitudTransferencia.productoId,
        cantidad: solicitudTransferencia.cantidad,
        sucursalOrigenId: solicitudTransferencia.sucursalOrigenId,
        sucursalDestinoId: solicitudTransferencia.sucursalDestinoId,
        usuarioEncargadoId: userID,
      };

      // 2. Obtener cantidades anteriores antes de mover stock
      // (para trackeo de sucursal origen)
      const stockOrigen = await tx.stock.aggregate({
        where: {
          productoId: dto.productoId,
          sucursalId: dto.sucursalOrigenId,
        },
        _sum: { cantidad: true },
      });
      const cantidadAnteriorOrigen = stockOrigen._sum.cantidad ?? 0;
      const cantidadNuevaOrigen = cantidadAnteriorOrigen - dto.cantidad;

      // (para trackeo de sucursal destino)
      const stockDestino = await tx.stock.aggregate({
        where: {
          productoId: dto.productoId,
          sucursalId: dto.sucursalDestinoId,
        },
        _sum: { cantidad: true },
      });
      const cantidadAnteriorDestino = stockDestino._sum.cantidad ?? 0;
      const cantidadNuevaDestino = cantidadAnteriorDestino + dto.cantidad;

      // 3. Transferir stock y crear el registro de transferencia
      // (La lógica de transferirProducto ejecuta el movimiento y retorna el registro)
      const transferencia = await this.transferirProducto(dto, tx);

      // 4. TRACKER: historial en sucursal origen
      await this.tracker.transferenciaTracker(
        tx,
        dto.productoId,
        dto.sucursalOrigenId,
        userID,
        transferencia.id,
        cantidadAnteriorOrigen,
        cantidadNuevaOrigen,
      );

      // 5. TRACKER: historial en sucursal destino (opcional pero recomendado)
      await this.tracker.transferenciaTracker(
        tx,
        dto.productoId,
        dto.sucursalDestinoId,
        userID,
        transferencia.id,
        cantidadAnteriorDestino,
        cantidadNuevaDestino,
      );

      // 6. Notificar al usuario solicitante
      const mensaje = `Un administrador aceptó tu solicitud de transferencia para el producto "${solicitudTransferencia.producto.nombre}".`;
      await this.notificationService.createOneNotification(
        mensaje,
        userID,
        solicitudTransferencia.usuarioSolicitante.id,
        'TRANSFERENCIA',
        idSolicitudTransferencia,
        tx,
      );

      // 7. Eliminar la solicitud de transferencia
      await tx.solicitudTransferenciaProducto.delete({
        where: { id: idSolicitudTransferencia },
      });

      return {
        message:
          'Transferencia realizada, solicitud eliminada y notificación enviada con éxito',
        transferencia,
      };
    });
  }

  async rechazarTransferencia(
    idSolicitudTransferencia: number,
    userID: number,
  ) {
    try {
      const solicituDelete =
        await this.prisma.solicitudTransferenciaProducto.delete({
          where: {
            id: idSolicitudTransferencia,
          },
        });

      const product = await this.prisma.producto.findUnique({
        where: {
          id: solicituDelete.productoId,
        },
      });

      // CREAR UNA NOTIFICACION Y ENVIARLA CON EL METODO
      await this.notificationService.createOneNotification(
        `Un administrador rechazó tu solicitud de transferencia para el producto "${product.nombre}"`,
        userID,
        solicituDelete.usuarioSolicitanteId,
        'TRANSFERENCIA',
        // solicitudTranferenciaDetalles.id,
      );
    } catch (error) {
      throw new Error(`Error al aceptar la transferencia: ${error.message}`);
    }
  }

  //=====================================================================>

  // Nota: el tx ahora es un argumento obligatorio
  async transferirProducto(
    dto: CreateTransferenciaProductoDto,
    tx: Prisma.TransactionClient,
  ) {
    const {
      productoId,
      cantidad,
      sucursalOrigenId,
      sucursalDestinoId,
      usuarioEncargadoId,
    } = dto;

    // Usar tx en vez de this.prisma en TODO:
    const stockOrigenes = await tx.stock.findMany({
      where: { productoId, sucursalId: sucursalOrigenId },
      orderBy: { fechaIngreso: 'asc' },
    });

    const cantidadTotalStockOrigen = stockOrigenes.reduce(
      (total, stock) => total + stock.cantidad,
      0,
    );
    if (cantidadTotalStockOrigen < cantidad) {
      throw new Error('Stock insuficiente en la sucursal de origen');
    }

    let cantidadRestante = cantidad;

    for (const stock of stockOrigenes) {
      if (cantidadRestante === 0) break;
      if (stock.cantidad <= cantidadRestante) {
        await tx.stock.update({
          where: { id: stock.id },
          data: { cantidad: 0 },
        });
        cantidadRestante -= stock.cantidad;
      } else {
        await tx.stock.update({
          where: { id: stock.id },
          data: { cantidad: stock.cantidad - cantidadRestante },
        });
        cantidadRestante = 0;
      }
    }

    const stockDestino = await tx.stock.findFirst({
      where: { productoId, sucursalId: sucursalDestinoId },
    });

    if (stockDestino) {
      await tx.stock.update({
        where: { id: stockDestino.id },
        data: { cantidad: stockDestino.cantidad + cantidad },
      });
    } else {
      await tx.stock.create({
        data: {
          productoId,
          sucursalId: sucursalDestinoId,
          cantidad,
          precioCosto: stockOrigenes[0].precioCosto,
          costoTotal: stockOrigenes[0].precioCosto * cantidad,
          fechaIngreso: new Date(),
        },
      });
    }

    // Registrar la transferencia y regresar el registro (para el tracker)
    const transferencia = await tx.transferenciaProducto.create({
      data: {
        productoId,
        cantidad,
        sucursalOrigenId,
        sucursalDestinoId,
        usuarioEncargadoId,
        fechaTransferencia: new Date(),
      },
    });

    return transferencia;
  }

  async findAll() {
    try {
      const solicitudesTransferencia =
        await this.prisma.solicitudTransferenciaProducto.findMany({
          include: {
            producto: {
              select: {
                nombre: true,
              },
            },
            sucursalOrigen: {
              select: {
                nombre: true,
              },
            },
            sucursalDestino: {
              select: {
                nombre: true,
              },
            },
            usuarioSolicitante: {
              select: {
                nombre: true,
                rol: true,
              },
            },
          },
        });

      return solicitudesTransferencia;
    } catch (error) {
      console.log(error);

      throw new InternalServerErrorException(
        'Error al encontrar las solicitudes de trasnferencia',
      );
    }
  }

  findOne(id: number) {
    return `This action returns a #${id} solicitudTransferenciaProducto`;
  }

  update(
    id: number,
    updateSolicitudTransferenciaProductoDto: UpdateSolicitudTransferenciaProductoDto,
  ) {
    return `This action updates a #${id} solicitudTransferenciaProducto`;
  }

  async removeAll() {
    return this.prisma.solicitudTransferenciaProducto.deleteMany({});
  }

  remove(id: number) {
    return `This action removes a #${id} solicitudTransferenciaProducto`;
  }
}
