import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { CreateVencimientoDto } from './dto/create-vencimiento.dto';
import { UpdateVencimientoDto } from './dto/update-vencimiento.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationService } from 'src/notification/notification.service';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';
import 'dayjs/locale/es-mx';
import { differenceInCalendarDays } from 'date-fns';

dayjs.extend(utc);
dayjs.locale('es-mx');
dayjs.extend(timezone);
type NotifyVencimientoInput = {
  stockId: number; // id del registro de stock/lote
  productoId: number;
  productoNombre: string;
  sucursalId: number;
  sucursalNombre?: string | null;
  fechaVencimiento: Date;
  cantidad?: number | null;
  ubicacion?: string | null; // estante, bodega, etc. (si la tienes)
  adminActorId?: number | null; // quien disparó el proceso (opcional)
};
//formato UTC
// Función formatFecha corregida:
const formatFecha = (fecha: Date): string =>
  dayjs(fecha)
    .tz('America/Guatemala', true) // <-- Tercer parámetro es el booleano
    .locale('es')
    .format('D [de] MMMM [de] YYYY');

@Injectable()
export class VencimientosService {
  constructor(
    private readonly prisma: PrismaService,

    private readonly notificationService: NotificationService,
  ) {}

  @Cron('0 23 * * *', {
    name: 'vencimientos.midnightGuate',
    timeZone: 'America/Guatemala',
  })
  async handleCronVencimientos() {
    await this.procesarVencimientos();
  }

  private async procesarVencimientos() {
    const hoy = dayjs().tz('America/Guatemala').startOf('day');
    const limite = hoy.add(15, 'day').endOf('day');

    console.log('🔍 Buscando vencimientos entre:', {
      desde: dayjs(hoy.toISOString()).format('DD MM YYYY'),
      hasta: dayjs(limite.toISOString()).format('DD MM YYYY'),
    });

    const stocks = await this.prisma.stock.findMany({
      where: {
        fechaVencimiento: {
          gte: hoy.toDate(),
          lte: limite.toDate(),
        },
      },
    });
    const admins = await this.prisma.usuario.findMany({
      where: { rol: 'ADMIN' },
    });

    for (const stock of stocks) {
      await this.procesarStock(stock, admins, hoy);
    }
  }

  private async procesarStock(stock, admins, hoy) {
    const ya = await this.prisma.vencimiento.findFirst({
      where: { stockId: stock.id },
    });
    if (ya) return;

    const producto = await this.prisma.producto.findUnique({
      where: { id: stock.productoId },
    });
    if (!producto) return;

    // const localExp = dayjs
    //   .tz(stock.fechaVencimiento, 'America/Guatemala')
    //   .startOf('day');
    // Dentro de procesarStock:
    const localExp = dayjs(stock.fechaVencimiento)
      .tz('America/Guatemala', true) // <-- Usar booleano directamente
      .startOf('day');

    const fechaCruda = new Date(stock.fechaVencimiento);
    const fechaSinFormato = stock.fechaVencimiento;

    console.log('la fecha cruda es: ', fechaCruda);
    console.log('la fechaSinFormatoa es: ', fechaSinFormato);

    console.log(
      'La fecha que vence es: ',
      dayjs(localExp).format('DD MM YYYY'),
    );

    const diasFaltan = localExp.diff(hoy, 'day');

    const formattedDate = localExp
      .locale('es-mx')
      .format('D [de] MMMM [de] YYYY');

    const venc = await this.prisma.vencimiento.create({
      data: {
        fechaVencimiento: stock.fechaVencimiento,
        descripcion: `El producto ${producto.nombre} vence en ${diasFaltan} días (el ${formattedDate}).`,
        stockId: stock.id,
        estado: 'PENDIENTE',
      },
    });
    console.log('Vencimiento creado:', venc.id);

    await Promise.all(
      admins.map((adm) => this.notificarAdmin(adm.id, stock, producto)),
    );
  }

  private async notificarAdmin(adminId: number, stock, producto) {
    const existe = await this.prisma.notificacion.findFirst({
      where: {
        referenciaId: stock.id,
        notificacionesUsuarios: { some: { usuarioId: adminId } },
      },
    });
    if (existe) return;

    await this.notifyVencimientoProducto(
      this.prisma,
      this.notificationService,
      {
        stockId: stock.id,
        productoId: producto.id,
        productoNombre: producto.nombre,
        sucursalId: stock.sucursalId, // asegúrate de tenerlo a mano
        sucursalNombre: stock.sucursal?.nombre, // si lo tienes
        fechaVencimiento: stock.fechaVencimiento,
        cantidad: stock.cantidad ?? null,
        ubicacion: stock.ubicacion ?? null, // si existe
        adminActorId: null, // si alguien lanzó la revisión
      },
    );

    console.log(`Notificación enviada a admin ${adminId}`);
  }

  create(createVencimientoDto: CreateVencimientoDto) {
    return 'This action adds a new vencimiento';
  }

  async findAll() {
    try {
      const registrosVencimiento = await this.prisma.vencimiento.findMany({
        orderBy: {
          fechaCreacion: 'desc',
        },
        where: {
          stock: {
            isNot: null,
          },
        },
        include: {
          stock: {
            select: {
              sucursal: {
                select: {
                  id: true,
                  nombre: true,
                },
              },
              producto: {
                select: {
                  id: true,
                  nombre: true,
                  codigoProducto: true,
                },
              },
            },
          },
        },
      });
      return registrosVencimiento;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Error al conseguir registros');
    }
  }

  findOne(id: number) {
    return `This action returns a #${id} vencimiento`;
  }

  async update(id: number, updateVencimientoDto: UpdateVencimientoDto) {
    try {
      const vencimientoActualizado = await this.prisma.vencimiento.update({
        where: {
          id: id,
        },
        data: {
          estado: 'RESUELTO',
        },
      });
      return vencimientoActualizado;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Error al actualizar registro');
    }
  }

  async removeAll() {
    try {
      const regists = await this.prisma.vencimiento.deleteMany({});
      return regists;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Error al eliminar registros');
    }
  }

  remove(id: number) {
    return `This action removes a #${id} vencimiento`;
  }

  //NUEVO HELPER
  // o usa dayjs si ya lo tienes

  pickSeveridadPorVencimiento(
    diasRestantes: number,
  ): 'CRITICO' | 'ALERTA' | 'INFORMACION' {
    if (diasRestantes <= 0) return 'CRITICO';
    if (diasRestantes <= 7) return 'ALERTA';
    return 'INFORMACION';
  }

  async notifyVencimientoProducto(
    prisma: PrismaService,
    notifications: NotificationService,
    input: NotifyVencimientoInput,
  ) {
    const {
      stockId,
      productoId,
      productoNombre,
      sucursalId,
      sucursalNombre,
      fechaVencimiento,
      cantidad,
      ubicacion,
      adminActorId,
    } = input;

    // 1) Destinatarios: admins de la sucursal
    const admins = await prisma.usuario.findMany({
      where: { rol: 'ADMIN', sucursalId, activo: true },
      select: { id: true },
    });
    const userIds = admins.map((a) => a.id);
    if (userIds.length === 0) return; // opcional: fallback a admins globales

    // 2) Severidad por proximidad
    const hoy = new Date();
    const dias = differenceInCalendarDays(fechaVencimiento, hoy);
    const severidad = this.pickSeveridadPorVencimiento(dias);

    // 3) Mensajes y ruta
    const fechaFmt = fechaVencimiento.toLocaleDateString('es-GT', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
    const titulo =
      dias <= 0
        ? 'Producto vencido'
        : dias <= 7
          ? 'Producto por vencer (≤ 7 días)'
          : 'Producto por vencer (≤ 30 días)';
    const mensaje =
      dias <= 0
        ? `El producto "${productoNombre}" está VENCIDO desde ${fechaFmt}.`
        : `El producto "${productoNombre}" vence el ${fechaFmt} (faltan ${dias} día${dias === 1 ? '' : 's'}).`;

    // Deep link al detalle del producto/lote (ajusta a tu routing real)
    const route = `/inventario/producto/${productoId}?highlightStock=${stockId}`;

    // 4) Crear y emitir una sola notificación para todos
    await notifications.createForUsers({
      userIds,
      titulo,
      mensaje,
      categoria: 'INVENTARIO',
      severidad, // INFORMACION | ALERTA | CRITICO
      subtipo: 'EXPIRY', // estandarizamos subtipo
      route,
      actionLabel: 'Revisar lote',
      referenciaTipo: 'Stock', // o 'Lote' si así lo nombras
      referenciaId: stockId,
      remitenteId: adminActorId ?? null, // si existe actor
      sucursalId,
      meta: {
        stockId,
        producto: { id: productoId, nombre: productoNombre },
        sucursal: { id: sucursalId, nombre: sucursalNombre ?? null },
        fechaVencimiento: fechaVencimiento.toISOString(),
        diasRestantes: dias,
        cantidad: cantidad ?? null,
        ubicacion: ubicacion ?? null,
      },
      audiencia: 'USUARIOS',
    });
  }
}
