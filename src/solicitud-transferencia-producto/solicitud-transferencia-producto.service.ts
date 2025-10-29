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
      const {
        cantidad,
        productoId,
        sucursalOrigenId,
        sucursalDestinoId,
        usuarioSolicitanteId,
      } = createSolicitudTransferenciaProductoDto;

      // 1) Crear la solicitud
      const solicitud = await this.prisma.solicitudTransferenciaProducto.create(
        {
          data: {
            cantidad,
            estado: 'PENDIENTE',
            productoId,
            sucursalOrigenId,
            sucursalDestinoId,
            usuarioSolicitanteId,
          },
        },
      );

      // 2) Cargar datos mínimos para armar el mensaje/meta
      const [user, product, sucOrigen, sucDestino] = await Promise.all([
        this.prisma.usuario.findUnique({
          where: { id: usuarioSolicitanteId },
          select: { id: true, nombre: true, rol: true },
        }),
        this.prisma.producto.findUnique({
          where: { id: productoId },
          select: { id: true, nombre: true },
        }),
        this.prisma.sucursal.findUnique({
          where: { id: sucursalOrigenId },
          select: { id: true, nombre: true },
        }),
        this.prisma.sucursal.findUnique({
          where: { id: sucursalDestinoId },
          select: { id: true, nombre: true },
        }),
      ]);

      // 3) Destinatarios: admins de la sucursal destino
      const adminsDestino = await this.prisma.usuario.findMany({
        where: { rol: 'ADMIN', sucursalId: sucursalDestinoId, activo: true },
        select: { id: true },
      });
      const userIds = adminsDestino.map((a) => a.id);
      if (userIds.length === 0) {
        // fallback opcional: admins globales
        const adminsGlobal = await this.prisma.usuario.findMany({
          where: { rol: 'ADMIN', activo: true },
          select: { id: true },
        });
        userIds.push(...adminsGlobal.map((a) => a.id));
      }

      // 4) Formato estandarizado (mismo que GET y que llega por WS `noti:new`)
      const titulo = 'Nueva solicitud de transferencia';
      const mensaje = `El usuario ${user?.nombre ?? 'N/D'} solicitó transferir ${cantidad} ud de "${product?.nombre ?? 'Producto'}" de "${sucOrigen?.nombre ?? 'Origen'}" hacia "${sucDestino?.nombre ?? 'Destino'}".`;

      // Deep link a detalle (ajústalo a tu ruta real)
      const route = `/transferencias/solicitudes/${solicitud.id}`;

      // 5) Persistir y emitir **una sola vez** para todos los destinatarios
      await this.notificationService.createForUsers({
        userIds,
        titulo,
        mensaje,
        categoria: 'INVENTARIO', // ← categoría de tu enum
        severidad: 'INFORMACION', // ALERTA si quieres resaltarlo más
        subtipo: 'TRANSFER_REQUEST', // libre, para analítica/reglas
        route,
        actionLabel: 'Revisar solicitud',
        referenciaTipo: 'SolicitudTransferenciaProducto',
        referenciaId: solicitud.id,
        remitenteId: usuarioSolicitanteId,
        sucursalId: sucursalDestinoId, // filtra por sucursal destino en dashboards
        meta: {
          solicitudId: solicitud.id,
          cantidad,
          producto: {
            id: product?.id ?? productoId,
            nombre: product?.nombre ?? null,
          },
          sucursalOrigen: {
            id: sucOrigen?.id ?? sucursalOrigenId,
            nombre: sucOrigen?.nombre ?? null,
          },
          sucursalDestino: {
            id: sucDestino?.id ?? sucursalDestinoId,
            nombre: sucDestino?.nombre ?? null,
          },
          solicitante: {
            id: user?.id ?? usuarioSolicitanteId,
            nombre: user?.nombre ?? null,
            rol: user?.rol ?? null,
          },
        },
        audiencia: 'USUARIOS', // intención (persistimos por usuario)
      });

      // 6) (Opcional) Evento de dominio por WS, para widgets “en vivo”
      // Si tu UI escucha "transferencia:solicitud", emítelo a rol ADMIN (rooms):
      this.webSocketGateway.emitTransferenciaToAdmins({
        id: solicitud.id,
        monto: 0, // si aplica, o remuévelo del payload de ese evento
        deSucursal: sucursalOrigenId,
        aSucursal: sucursalDestinoId,
      });

      return solicitud;
    } catch (error) {
      console.error(error);
      throw new BadRequestException(
        'Error al crear la solicitud de transferencia',
      );
    }
  }

  async createTransferencia(idSolicitudTransferencia: number, userID: number) {
    // 1) Ejecuta TODO lo transaccional y devuelve contexto para notificaciones
    const ctx = await this.prisma.$transaction(async (tx) => {
      const solicitud = await tx.solicitudTransferenciaProducto.findUnique({
        where: { id: idSolicitudTransferencia },
        include: {
          producto: { select: { id: true, nombre: true } },
          sucursalOrigen: { select: { id: true, nombre: true } },
          sucursalDestino: { select: { id: true, nombre: true } },
          usuarioSolicitante: { select: { id: true, nombre: true } },
        },
      });
      if (!solicitud)
        throw new Error('Solicitud de transferencia no encontrada');

      const dto: CreateTransferenciaProductoDto = {
        productoId: solicitud.productoId,
        cantidad: solicitud.cantidad,
        sucursalOrigenId: solicitud.sucursalOrigenId,
        sucursalDestinoId: solicitud.sucursalDestinoId,
        usuarioEncargadoId: userID,
      };

      // stock antes (para meta/auditoría)
      const [sumOrigen, sumDestino] = await Promise.all([
        tx.stock.aggregate({
          where: {
            productoId: dto.productoId,
            sucursalId: dto.sucursalOrigenId,
          },
          _sum: { cantidad: true },
        }),
        tx.stock.aggregate({
          where: {
            productoId: dto.productoId,
            sucursalId: dto.sucursalDestinoId,
          },
          _sum: { cantidad: true },
        }),
      ]);
      const cantidadAnteriorOrigen = sumOrigen._sum.cantidad ?? 0;
      const cantidadAnteriorDestino = sumDestino._sum.cantidad ?? 0;

      // mover stock + registro transferencia
      const transferencia = await this.transferirProducto(dto, tx);

      // trackers
      await this.tracker.transferenciaTracker(
        tx,
        dto.productoId,
        dto.sucursalOrigenId,
        userID,
        transferencia.id,
        cantidadAnteriorOrigen,
        cantidadAnteriorOrigen - dto.cantidad,
      );
      await this.tracker.transferenciaTracker(
        tx,
        dto.productoId,
        dto.sucursalDestinoId,
        userID,
        transferencia.id,
        cantidadAnteriorDestino,
        cantidadAnteriorDestino + dto.cantidad,
      );

      // elimina solicitud (aceptada)
      await tx.solicitudTransferenciaProducto.delete({
        where: { id: idSolicitudTransferencia },
      });

      // devuelve todo lo necesario para notificaciones fuera del tx
      return {
        transferencia,
        solicitud: {
          id: idSolicitudTransferencia,
          cantidad: solicitud.cantidad,
          producto: solicitud.producto,
          sucursalOrigen: solicitud.sucursalOrigen,
          sucursalDestino: solicitud.sucursalDestino,
          solicitante: solicitud.usuarioSolicitante,
        },
        cantidades: {
          origenAntes: cantidadAnteriorOrigen,
          destinoAntes: cantidadAnteriorDestino,
        },
      };
    });

    // 2) Una vez COMMIT OK → arma y emite notificaciones (persisten + WS)
    const { transferencia, solicitud, cantidades } = ctx;

    // destinatarios
    const [adminsDestino, adminsOrigen] = await Promise.all([
      this.prisma.usuario.findMany({
        where: {
          rol: 'ADMIN',
          sucursalId: solicitud.sucursalDestino.id,
          activo: true,
        },
        select: { id: true },
      }),
      this.prisma.usuario.findMany({
        where: {
          rol: 'ADMIN',
          sucursalId: solicitud.sucursalOrigen.id,
          activo: true,
        },
        select: { id: true },
      }),
    ]);
    const idsAdminsDestino = adminsDestino.map((a) => a.id);
    const idsAdminsOrigen = adminsOrigen.map((a) => a.id);

    // a) Notificación al SOLICITANTE
    await this.notificationService.createOne({
      userId: solicitud.solicitante.id,
      titulo: 'Transferencia aceptada',
      mensaje: `Se aceptó tu solicitud de transferencia: ${solicitud.cantidad} ud de "${solicitud.producto.nombre}" hacia "${solicitud.sucursalDestino.nombre}".`,
      categoria: 'INVENTARIO',
      severidad: 'EXITO',
      subtipo: 'TRANSFER_ACCEPTED',
      route: `/transferencias/${transferencia.id}`, // deep link al registro de transferencia
      referenciaTipo: 'TransferenciaProducto',
      referenciaId: transferencia.id, // referencia al NUEVO registro (mejor que la solicitud eliminada)
      remitenteId: userID,
      sucursalId: solicitud.sucursalDestino.id,
      actionLabel: 'Ver transferencia',
      meta: {
        solicitudId: solicitud.id,
        transferenciaId: transferencia.id,
        producto: {
          id: solicitud.producto.id,
          nombre: solicitud.producto.nombre,
        },
        cantidad: solicitud.cantidad,
        sucursalOrigen: {
          id: solicitud.sucursalOrigen.id,
          nombre: solicitud.sucursalOrigen.nombre,
        },
        sucursalDestino: {
          id: solicitud.sucursalDestino.id,
          nombre: solicitud.sucursalDestino.nombre,
        },
      },
    });

    // b) Notificación a ADMINS DESTINO (quienes reciben)
    if (idsAdminsDestino.length) {
      await this.notificationService.createForUsers({
        userIds: idsAdminsDestino,
        titulo: 'Transferencia recibida (aceptada)',
        mensaje: `Llegará ${solicitud.cantidad} ud de "${solicitud.producto.nombre}" desde "${solicitud.sucursalOrigen.nombre}".`,
        categoria: 'INVENTARIO',
        severidad: 'INFORMACION',
        subtipo: 'TRANSFER_ACCEPTED_DESTINO',
        route: `/transferencias/${transferencia.id}`,
        referenciaTipo: 'TransferenciaProducto',
        referenciaId: transferencia.id,
        remitenteId: userID,
        sucursalId: solicitud.sucursalDestino.id,
        actionLabel: 'Revisar',
        meta: {
          transferenciaId: transferencia.id,
          cantidad: solicitud.cantidad,
          destinoAntes: cantidades.destinoAntes,
          destinoDespues: cantidades.destinoAntes + solicitud.cantidad,
          producto: {
            id: solicitud.producto.id,
            nombre: solicitud.producto.nombre,
          },
          origen: {
            id: solicitud.sucursalOrigen.id,
            nombre: solicitud.sucursalOrigen.nombre,
          },
          destino: {
            id: solicitud.sucursalDestino.id,
            nombre: solicitud.sucursalDestino.nombre,
          },
        },
      });
    }

    // c) (Opcional) Notificación a ADMINS ORIGEN (visibilidad/auditoría)
    if (idsAdminsOrigen.length) {
      await this.notificationService.createForUsers({
        userIds: idsAdminsOrigen,
        titulo: 'Transferencia despachada (aceptada)',
        mensaje: `Se despachó ${solicitud.cantidad} ud de "${solicitud.producto.nombre}" hacia "${solicitud.sucursalDestino.nombre}".`,
        categoria: 'INVENTARIO',
        severidad: 'INFORMACION',
        subtipo: 'TRANSFER_ACCEPTED_ORIGEN',
        route: `/transferencias/${transferencia.id}`,
        referenciaTipo: 'TransferenciaProducto',
        referenciaId: transferencia.id,
        remitenteId: userID,
        sucursalId: solicitud.sucursalOrigen.id,
        actionLabel: 'Ver detalle',
        meta: {
          transferenciaId: transferencia.id,
          cantidad: solicitud.cantidad,
          origenAntes: cantidades.origenAntes,
          origenDespues: cantidades.origenAntes - solicitud.cantidad,
          producto: {
            id: solicitud.producto.id,
            nombre: solicitud.producto.nombre,
          },
          origen: {
            id: solicitud.sucursalOrigen.id,
            nombre: solicitud.sucursalOrigen.nombre,
          },
          destino: {
            id: solicitud.sucursalDestino.id,
            nombre: solicitud.sucursalDestino.nombre,
          },
        },
      });
    }

    // 3) (Opcional) Eventos de dominio para widgets en vivo
    // Rooms por sucursal → dashboards de inventario/transferencias
    this.webSocketGateway.emitToSucursal(
      solicitud.sucursalDestino.id,
      'transferencia:aceptada',
      {
        transferenciaId: transferencia.id,
        productoId: solicitud.producto.id,
        cantidad: solicitud.cantidad,
        deSucursal: solicitud.sucursalOrigen.id,
        aSucursal: solicitud.sucursalDestino.id,
      },
    );
    this.webSocketGateway.emitToSucursal(
      solicitud.sucursalOrigen.id,
      'transferencia:aceptada',
      {
        transferenciaId: transferencia.id,
        productoId: solicitud.producto.id,
        cantidad: solicitud.cantidad,
        deSucursal: solicitud.sucursalOrigen.id,
        aSucursal: solicitud.sucursalDestino.id,
      },
    );

    return {
      message: 'Transferencia realizada y notificaciones emitidas',
      transferencia,
    };
  }

  async rechazarTransferencia(
    idSolicitudTransferencia: number,
    userID: number, // admin que rechaza
    motivo?: string, // opcional: motivo del rechazo
  ) {
    // 1) Resolver datos y eliminar dentro de TX
    const ctx = await this.prisma.$transaction(async (tx) => {
      const solicitud = await tx.solicitudTransferenciaProducto.findUnique({
        where: { id: idSolicitudTransferencia },
        include: {
          producto: { select: { id: true, nombre: true } },
          sucursalOrigen: { select: { id: true, nombre: true } },
          sucursalDestino: { select: { id: true, nombre: true } },
          usuarioSolicitante: { select: { id: true, nombre: true } },
        },
      });

      if (!solicitud) {
        throw new Error('Solicitud de transferencia no encontrada');
      }

      await tx.solicitudTransferenciaProducto.delete({
        where: { id: idSolicitudTransferencia },
      });

      return {
        solicitud: {
          id: solicitud.id,
          cantidad: solicitud.cantidad,
          producto: solicitud.producto,
          sucursalOrigen: solicitud.sucursalOrigen,
          sucursalDestino: solicitud.sucursalDestino,
          solicitante: solicitud.usuarioSolicitante,
        },
      };
    });

    // 2) Fuera del TX: notificaciones + WS
    const { solicitud } = ctx;

    // a) Notifica al SOLICITANTE (principal)
    await this.notificationService.createOne({
      userId: solicitud.solicitante.id,
      titulo: 'Transferencia rechazada',
      mensaje: `Se rechazó tu solicitud de transferencia: ${solicitud.cantidad} ud de "${solicitud.producto.nombre}" de "${solicitud.sucursalOrigen.nombre}" hacia "${solicitud.sucursalDestino.nombre}".${motivo ? ' Motivo: ' + motivo : ''}`,
      categoria: 'INVENTARIO',
      severidad: 'ALERTA', // o INFORMACION si prefieres neutro
      subtipo: 'TRANSFER_REJECTED',
      // La solicitud ya no existe, evita enlazar al recurso borrado:
      route: '/transferencias/solicitudes', // o a una pantalla general de solicitudes
      referenciaTipo: null, // no referencies un recurso borrado
      referenciaId: null,
      remitenteId: userID, // quién rechazó
      // Puedes asociarla a la sucursal destino, porque era quien iba a recibir:
      sucursalId: solicitud.sucursalDestino.id,
      actionLabel: 'Ver solicitudes',
      meta: {
        solicitudId: solicitud.id, // trazabilidad
        producto: {
          id: solicitud.producto.id,
          nombre: solicitud.producto.nombre,
        },
        cantidad: solicitud.cantidad,
        sucursalOrigen: {
          id: solicitud.sucursalOrigen.id,
          nombre: solicitud.sucursalOrigen.nombre,
        },
        sucursalDestino: {
          id: solicitud.sucursalDestino.id,
          nombre: solicitud.sucursalDestino.nombre,
        },
        motivo: motivo ?? null,
      },
    });

    return { message: 'Solicitud rechazada y notificación enviada' };
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
