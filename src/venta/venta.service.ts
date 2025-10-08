import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateVentaDto } from './dto/create-venta.dto';
import { UpdateVentaDto } from './dto/update-venta.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { ClientService } from 'src/client/client.service';
import { NotificationService } from 'src/notification/notification.service';
import { NotificationToEmit } from 'src/web-sockets/Types/NotificationTypeSocket';
import { Prisma, TipoNotificacion } from '@prisma/client';
import { HistorialStockTrackerService } from 'src/historial-stock-tracker/historial-stock-tracker.service';
import { CreateRequisicionRecepcionLineaDto } from 'src/recepcion-requisiciones/dto/requisicion-recepcion-create.dto';
import { SoloIDProductos } from 'src/recepcion-requisiciones/dto/create-venta-tracker.dto';
import { CajaService } from 'src/caja/caja.service';
const toNumber4 = (v: number | Prisma.Decimal) =>
  typeof v === 'number' ? v : Number(v.toFixed(4));
@Injectable()
export class VentaService {
  //
  private logger = new Logger(VentaService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly clienteService: ClientService, // Inyección del servicio Cliente
    private readonly notifications: NotificationService,
    private readonly tracker: HistorialStockTrackerService,
    private readonly cajaService: CajaService,
  ) {}

  async create(createVentaDto: CreateVentaDto) {
    const {
      sucursalId,
      clienteId,
      productos,
      metodoPago,
      nombre,
      dpi,
      telefono,
      direccion,
      imei,
      observaciones,
      usuarioId,
      tipoComprobante,
      referenciaPago,
      apellidos,
    } = createVentaDto;

    this.logger.log('La reference es: ', referenciaPago);
    this.logger.log('La tipoComprobante es: ', tipoComprobante);

    // normaliza referencia
    const referenciaPagoValid =
      referenciaPago && referenciaPago.trim() !== ''
        ? referenciaPago.trim()
        : null;

    // ⛔️ TEMP: ventas por presentaciones deshabilitadas
    if (productos.some((p) => !!p.presentacionId)) {
      throw new BadRequestException(
        'La venta por presentaciones está deshabilitada temporalmente. Selecciona el producto base.',
      );
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        // === Notificaciones (igual)
        const usuariosNotif = await tx.usuario.findMany({
          where: { rol: { in: ['ADMIN', 'VENDEDOR'] } },
        });
        const usuariosNotifIds = usuariosNotif.map((u) => u.id);

        // === Cliente (igual)
        let clienteConnect: { connect: { id: number } } | undefined;
        if (clienteId) {
          clienteConnect = { connect: { id: clienteId } };
        } else if (nombre) {
          const nuevoCliente = await tx.cliente.create({
            data: {
              nombre,
              dpi,
              telefono,
              direccion,
              observaciones,
              apellidos,
            },
          });
          clienteConnect = { connect: { id: nuevoCliente.id } };
        }

        // === Validación de precios (SOLO producto) y normalización de líneas
        type LineaEntrada = (typeof productos)[number];
        type LineaValidada = {
          productoId: number;
          cantidad: number;
          precioVenta: Prisma.Decimal; // precio del producto (no presentación)
          tipoPrecio: string;
          selectedPriceId: number;
        };

        const validados: LineaValidada[] = await Promise.all(
          productos.map<Promise<LineaValidada>>(async (p: LineaEntrada) => {
            // precio debe ser de producto (presentacionId === null)
            const precio = await tx.precioProducto.findUnique({
              where: { id: p.selectedPriceId },
              select: {
                id: true,
                precio: true,
                tipo: true,
                usado: true,
                presentacionId: true,
                productoId: true,
              },
            });

            if (!precio || precio.usado) {
              throw new BadRequestException(
                `Precio no válido para producto ${p.productoId}`,
              );
            }
            if (precio.presentacionId) {
              // seguridad: no permitimos precios de presentaciones
              throw new BadRequestException(
                `El precio seleccionado pertenece a una presentación y la venta por presentaciones está deshabilitada.`,
              );
            }
            if (precio.productoId !== p.productoId) {
              throw new BadRequestException(
                `El precio no corresponde al producto ${p.productoId}.`,
              );
            }

            const cantidad = Number(p.cantidad ?? 0);
            if (!Number.isFinite(cantidad) || cantidad <= 0) {
              throw new BadRequestException(
                `Cantidad inválida para producto ${p.productoId}.`,
              );
            }

            return {
              productoId: p.productoId,
              cantidad,
              precioVenta: precio.precio as Prisma.Decimal,
              tipoPrecio: precio.tipo as unknown as string,
              selectedPriceId: p.selectedPriceId,
            };
          }),
        );

        // === Consolidar por (productoId, selectedPriceId)
        const keyOf = (x: LineaValidada) =>
          `${x.productoId}|${x.selectedPriceId}`;
        const mapa = new Map<string, LineaValidada>();
        for (const cur of validados) {
          const k = keyOf(cur);
          const e = mapa.get(k);
          if (e) {
            e.cantidad += cur.cantidad;
          } else {
            mapa.set(k, { ...cur });
          }
        }
        const consolidados = Array.from(mapa.values());

        // === Foto cantidades anteriores (Stock base)
        const cantidadesAnteriores: Record<number, number> = {};
        const productosUnicos = Array.from(
          new Set(consolidados.map((x) => x.productoId)),
        );
        for (const prodId of productosUnicos) {
          const agg = await tx.stock.aggregate({
            where: { productoId: prodId, sucursalId },
            _sum: { cantidad: true },
          });
          cantidadesAnteriores[prodId] = agg._sum.cantidad ?? 0;
        }

        // === Descontar stock (solo base, FIFO por fechaIngreso)
        for (const linea of consolidados) {
          let restante = linea.cantidad;
          const lotes = await tx.stock.findMany({
            where: {
              productoId: linea.productoId,
              sucursalId,
              cantidad: { gt: 0 },
            },
            orderBy: { fechaIngreso: 'asc' }, // puedes cambiar a FEFO si lo deseas
          });

          for (const lote of lotes) {
            if (restante <= 0) break;
            const usar = Math.min(restante, lote.cantidad);
            await tx.stock.update({
              where: { id: lote.id },
              data: { cantidad: { decrement: usar } },
            });
            restante -= usar;
          }
          if (restante > 0) {
            throw new BadRequestException(
              `Stock insuficiente para producto ${linea.productoId}.`,
            );
          }
        }

        // === Notificaciones de stock mínimo (producto)
        for (const prodId of productosUnicos) {
          const agg = await tx.stock.aggregate({
            where: { productoId: prodId, sucursalId },
            _sum: { cantidad: true },
          });
          const stockGlobal = agg._sum.cantidad ?? 0;

          const th = await tx.stockThreshold.findUnique({
            where: { productoId: prodId },
          });
          if (!th) continue;

          if (stockGlobal <= th.stockMinimo) {
            const info = await tx.producto.findUnique({
              where: { id: prodId },
              select: { nombre: true },
            });

            for (const uId of usuariosNotifIds) {
              const existe = await tx.notificacion.findFirst({
                where: {
                  referenciaId: th.id,
                  tipoNotificacion: 'STOCK_BAJO',
                  notificacionesUsuarios: { some: { usuarioId: uId } },
                },
              });
              if (existe) continue;

              await this.notifications.createOneNotification(
                `El producto ${info?.nombre ?? prodId} ha alcanzado stock mínimo (quedan ${stockGlobal} uds).`,
                usuarioId,
                uId,
                'STOCK_BAJO',
                th.id,
              );
            }
          }
        }

        // === Total venta (Decimal)
        const totalVenta = consolidados.reduce((sum, x) => {
          const linea = x.precioVenta.mul(x.cantidad);
          return sum.add(linea);
        }, new Prisma.Decimal(0));

        // === Crear venta + líneas (solo producto)
        const venta = await tx.venta.create({
          data: {
            tipoComprobante,
            referenciaPago: referenciaPagoValid,
            usuario: { connect: { id: usuarioId } },
            cliente: clienteConnect,
            horaVenta: new Date(),
            totalVenta: toNumber4(totalVenta),
            imei,
            sucursal: { connect: { id: sucursalId } },
            productos: {
              create: consolidados.map((x) => ({
                producto: { connect: { id: x.productoId } },
                cantidad: x.cantidad,
                precioVenta: toNumber4(x.precioVenta),
                // sin presentacionId
              })),
            },
          },
        });

        // === Tracker: cantidad vendida en unidades base (aquí == cantidad)
        await this.tracker.trackerSalidaProductoVenta(
          tx,
          consolidados.map((x) => ({
            productoId: x.productoId,
            cantidadVendida: x.cantidad,
            cantidadAnterior: cantidadesAnteriores[x.productoId] ?? 0,
          })),
          sucursalId,
          usuarioId,
          venta.id,
          'SALIDA_VENTA',
          `Registro generado por venta #${venta.id}`,
        );

        // === Pago
        const pago = await tx.pago.create({
          data: {
            metodoPago: metodoPago || 'CONTADO',
            monto: Number(totalVenta),
            venta: { connect: { id: venta.id } },
          },
        });
        await tx.venta.update({
          where: { id: venta.id },
          data: { metodoPago: { connect: { id: pago.id } } },
        });

        // === Caja (igual)
        await this.cajaService.attachAndRecordSaleTx(
          tx,
          venta.id,
          sucursalId,
          usuarioId,
          { exigirCajaSiEfectivo: true },
        );

        return venta;
      });
    } catch (e) {
      this.logger.error('Error en createVenta:', e);
      if (e instanceof HttpException) throw e;
      throw new InternalServerErrorException('Fatal error: Error inesperado');
    }
  }

  async findAll() {
    try {
      const ventas = await this.prisma.venta.findMany({
        include: {
          cliente: true,
          metodoPago: true,
          productos: {
            include: {
              producto: true,
            },
          },
        },
        orderBy: {
          fechaVenta: 'desc',
        },
      });
      return ventas;
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Error al obtener las ventas');
    }
  }

  async findAllSaleSucursal(id: number) {
    try {
      const ventas = await this.prisma.venta.findMany({
        where: { sucursalId: id },
        orderBy: { fechaVenta: 'desc' },
        select: {
          id: true,
          clienteId: true,
          cliente: {
            select: {
              id: true,
              dpi: true,
              nombre: true,
              telefono: true,
              direccion: true,
              creadoEn: true,
              actualizadoEn: true,
              departamentoId: true,
              departamento: { select: { id: true, nombre: true } },
              municipio: { select: { id: true, nombre: true } },
            },
          },
          fechaVenta: true,
          horaVenta: true,
          productos: {
            select: {
              id: true,
              ventaId: true,
              productoId: true,
              cantidad: true,
              creadoEn: true,
              precioVenta: true,
              estado: true,
              producto: {
                select: {
                  id: true,
                  nombre: true,
                  descripcion: true,
                  codigoProducto: true,
                  creadoEn: true,
                  actualizadoEn: true,
                },
              },
            },
          },
          totalVenta: true,
          metodoPago: {
            select: {
              id: true,
              ventaId: true,
              monto: true,
              metodoPago: true,
              fechaPago: true,
            },
          },
          nombreClienteFinal: true,
          telefonoClienteFinal: true,
          direccionClienteFinal: true,
          referenciaPago: true,
          tipoComprobante: true,
        },
      });
      return ventas; // ya coincide con tu `Venta[]` en TS
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Error al obtener las ventas');
    }
  }

  async findOneSale(id: number) {
    try {
      const ventas = await this.prisma.venta.findUnique({
        where: {
          id: id,
        },

        include: {
          cliente: true,
          metodoPago: true,
          sucursal: {
            select: {
              direccion: true,
              nombre: true,
              id: true,
              telefono: true,
              pbx: true,
            },
          },
          productos: {
            include: {
              producto: true,
            },
            orderBy: {
              precioVenta: 'desc',
            },
          },
        },
      });
      return ventas;
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Error al obtener las ventas');
    }
  }

  async update(id: number, updateVentaDto: UpdateVentaDto) {
    try {
      const venta = await this.prisma.venta.update({
        where: { id },
        data: {
          productos: {
            connect: updateVentaDto.productos.map((prod) => ({
              id: prod.productoId,
            })),
          },
        },
      });

      if (!venta) {
        throw new NotFoundException(`Venta con ID ${id} no encontrada`);
      }
      return venta;
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Error al actualizar la venta');
    }
  }

  async getSalesToCashRegist(sucursalId: number, usuarioId: number) {
    try {
      const salesWithoutCashRegist = await this.prisma.venta.findMany({
        orderBy: {
          fechaVenta: 'desc',
        },
        where: {
          sucursalId: sucursalId,
          registroCajaId: null,
          usuarioId: usuarioId,
        },
        include: {
          productos: {
            select: {
              cantidad: true,
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

      if (!salesWithoutCashRegist) {
        throw new BadRequestException('Error al conseguir registros');
      }

      return salesWithoutCashRegist;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException(
        'Error al conseguir registros de ventas',
      );
    }
  }

  async removeAll() {
    try {
      const ventas = await this.prisma.venta.deleteMany({});
      return ventas;
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Error al eliminar las ventas');
    }
  }

  async getVentasToGarantia() {
    try {
      const ventasToGarantiaSelect = await this.prisma.venta.findMany({
        orderBy: {
          fechaVenta: 'desc',
        },
        select: {
          id: true,
          imei: true,
          fechaVenta: true,
          metodoPago: {
            select: {
              metodoPago: true,
            },
          },
          referenciaPago: true,
          tipoComprobante: true,
          sucursal: {
            select: {
              id: true,
              nombre: true,
              direccion: true,
            },
          },
          usuario: {
            select: {
              id: true,
              nombre: true,
              correo: true,
              rol: true,
            },
          },
          productos: {
            select: {
              estado: true,
              id: true,
              cantidad: true,
              precioVenta: true,
              producto: {
                select: {
                  id: true,
                  nombre: true,
                  codigoProducto: true,
                  descripcion: true,
                },
              },
            },
          },

          cliente: {
            select: {
              id: true,
              nombre: true,
            },
          },
        },
      });
      console.log('las ventas son: ', ventasToGarantiaSelect.length);

      const dataFormatt = ventasToGarantiaSelect.map((venta) => ({
        id: venta.id,
        imei: venta.imei,
        fechaVenta: venta.fechaVenta,
        metodoPago: venta.metodoPago?.metodoPago ?? '—',
        referenciaPago: venta.referenciaPago,
        tipoComprobante: venta.tipoComprobante,
        cliente: {
          id: venta.cliente?.id ?? null,
          nombre: venta.cliente?.nombre ?? 'CF',
        },
        usuario: {
          id: venta?.usuario?.id,
          nombre: venta?.usuario?.nombre,
          rol: venta?.usuario?.rol,
          correo: venta?.usuario?.correo,
        },
        sucursal: {
          id: venta.sucursal.id,
          nombre: venta.sucursal.nombre,
          direccion: venta.sucursal.direccion,
        },
        productos: venta.productos.map((linea) => ({
          id: linea.id,
          cantidad: linea.cantidad,
          precioVenta: linea.precioVenta,
          estado: linea.estado,
          producto: {
            id: linea.producto.id,
            nombre: linea.producto.nombre,
            descripcion: linea.producto.descripcion,
            codigoProducto: linea.producto.codigoProducto,
          },
        })),
      }));
      return dataFormatt;
    } catch (error) {
      console.log('El error es: ', error);
      throw error;
    }
  }

  async remove(id: number) {
    try {
      const venta = await this.prisma.venta.delete({
        where: { id },
      });
      if (!venta) {
        throw new NotFoundException(`Venta con ID ${id} no encontrada`);
      }
      return venta;
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Error al eliminar la venta');
    }
  }

  //Ventas del cliente
  async findAllSaleCustomer(customerId: number) {
    try {
      const ventas = await this.prisma.venta.findMany({
        where: {
          clienteId: customerId,
        },
        include: {
          cliente: true,
          metodoPago: true,
          productos: {
            include: {
              producto: true,
            },
          },
        },
        orderBy: {
          fechaVenta: 'desc',
        },
      });
      return ventas;
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Error al obtener las ventas');
    }
  }
}
