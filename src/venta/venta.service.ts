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
    let referenciaPagoValid: string | null = null;
    if (referenciaPago && referenciaPago.trim() !== '') {
      referenciaPagoValid = referenciaPago.trim();
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        // --- Notificaciones (igual que antes)
        const usuariosNotif = await tx.usuario.findMany({
          where: { rol: { in: ['ADMIN', 'VENDEDOR'] } },
        });
        const usuariosNotifIds = usuariosNotif.map((u) => u.id);

        // --- Cliente (igual que antes)
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

        // --- Validar precios y resolver factor de presentación (si aplica)
        type LineaEntrada = (typeof productos)[number];
        type LineaValidada = {
          productoId: number;
          presentacionId: number | null;
          cantidadPresentacion: number; // si no hay presentacionId, esto es en unidades base (equivalente a presentacion default de factor 1)
          precioVenta: Prisma.Decimal; // Decimal
          tipoPrecio: string; // ajusta el tipo si lo tienes tipado
          selectedPriceId: number;
          factorUnidadBase: Prisma.Decimal; // Decimal(18,6) para conversión -> unidades base
        };

        const validados: LineaValidada[] = await Promise.all(
          productos.map<Promise<LineaValidada>>(async (p: LineaEntrada) => {
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
              throw new Error(`Precio no válido para producto ${p.productoId}`);
            }

            // Si viene presentacionId en la línea, tomamos factor real; si no, factor = 1
            let factor = new Prisma.Decimal(1);
            if (p.presentacionId) {
              const pres = await tx.productoPresentacion.findUnique({
                where: { id: p.presentacionId },
                select: { id: true, productoId: true, factorUnidadBase: true },
              });
              if (!pres || pres.productoId !== p.productoId) {
                throw new Error(
                  `Presentación inválida para el producto ${p.productoId}`,
                );
              }
              factor = pres.factorUnidadBase as Prisma.Decimal;
            }

            return {
              productoId: p.productoId,
              presentacionId: p.presentacionId ?? null,
              cantidadPresentacion: p.cantidad,
              precioVenta: precio.precio as Prisma.Decimal,
              tipoPrecio: precio.tipo as unknown as string,
              selectedPriceId: p.selectedPriceId,
              factorUnidadBase: factor,
            };
          }),
        );

        // --- Consolidar por (productoId, presentacionId, selectedPriceId)
        const keyOf = (x: LineaValidada) =>
          `${x.productoId}|${x.presentacionId ?? 0}|${x.selectedPriceId}`;
        const mapa = new Map<string, LineaValidada>();
        for (const cur of validados) {
          const k = keyOf(cur);
          const e = mapa.get(k);
          if (e) {
            e.cantidadPresentacion += cur.cantidadPresentacion;
            // precioVenta permanece (mismo selectedPriceId)
          } else {
            mapa.set(k, { ...cur });
          }
        }
        const consolidados = Array.from(mapa.values());

        // --- Foto de cantidades anteriores (en Stock viejo por producto+sucursal, en unidades base)
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

        // --- Descontar stock (presentacion-aware) en ambas tablas:
        //     - Si hay presentacionId: consumir StockPresentacion (por presentación) y además Stock (producto) en unidades base
        //     - Si NO hay presentacionId: comportamiento legacy (solo Stock)
        for (const linea of consolidados) {
          const unidadesBaseNecesarias = (
            linea.factorUnidadBase as Prisma.Decimal
          ).mul(linea.cantidadPresentacion);

          if (linea.presentacionId) {
            // 1) Consumir lotes en StockPresentacion (FIFO simple por fechaIngreso)
            let restantePres = linea.cantidadPresentacion;
            const lotesPres = await tx.stockPresentacion.findMany({
              where: {
                productoId: linea.productoId,
                presentacionId: linea.presentacionId,
                sucursalId,
                cantidadPresentacion: { gt: 0 },
              },
              orderBy: [
                // Si manejas fechas de vencimiento, puedes agregar { fechaVencimiento: 'asc' } primero (FEFO)
                { fechaIngreso: 'asc' },
              ],
            });

            for (const lote of lotesPres) {
              if (restantePres <= 0) break;
              const usar = Math.min(restantePres, lote.cantidadPresentacion);
              await tx.stockPresentacion.update({
                where: { id: lote.id },
                data: { cantidadPresentacion: { decrement: usar } },
              });
              restantePres -= usar;
            }
            if (restantePres > 0) {
              throw new Error(
                `Stock por presentación insuficiente para producto ${linea.productoId} (presentación ${linea.presentacionId}).`,
              );
            }

            // 2) Consumir lotes en Stock (legacy) en unidades base
            let restanteBase = unidadesBaseNecesarias;
            const lotesBase = await tx.stock.findMany({
              where: {
                productoId: linea.productoId,
                sucursalId,
                cantidad: { gt: 0 },
              },
              orderBy: { fechaIngreso: 'asc' },
            });

            for (const lote of lotesBase) {
              if (restanteBase.lte(0)) break;

              const disponible = new Prisma.Decimal(lote.cantidad);
              const usar = Prisma.Decimal.min(disponible, restanteBase);

              // decremento entero: si tus unidades base son enteras, conviene castear a Number seguro
              const usarInt = Number(usar.toFixed(0));
              if (usarInt > 0) {
                await tx.stock.update({
                  where: { id: lote.id },
                  data: { cantidad: { decrement: usarInt } },
                });
                restanteBase = restanteBase.sub(usar);
              }
            }
            if (restanteBase.gt(0)) {
              throw new Error(
                `Stock insuficiente en inventario legacy para producto ${linea.productoId}.`,
              );
            }
          } else {
            // Legacy: sin presentación -> consumir Stock (producto) exactamente como antes
            let restante = linea.cantidadPresentacion; // aquí cantidad ya está en unidades base
            const lotes = await tx.stock.findMany({
              where: {
                productoId: linea.productoId,
                sucursalId,
                cantidad: { gt: 0 },
              },
              orderBy: { fechaIngreso: 'asc' },
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
              throw new Error(
                `Stock insuficiente para producto ${linea.productoId}.`,
              );
            }
          }
        }

        // --- Notificaciones de stock mínimo (igual que antes, pero ya descontado)
        for (const prodId of productosUnicos) {
          const agg = await tx.stock.aggregate({
            where: { productoId: prodId },
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

        // --- Total venta (Decimal)
        const totalVenta = consolidados.reduce((sum, x) => {
          const linea = x.precioVenta.mul(x.cantidadPresentacion); // ojo: precio ya corresponde a la presentación elegida o al producto
          return sum.add(linea);
        }, new Prisma.Decimal(0));

        // --- Crear venta + líneas (incluye presentacionId si aplica)
        const venta = await tx.venta.create({
          data: {
            tipoComprobante,
            referenciaPago: referenciaPagoValid,
            usuario: { connect: { id: usuarioId } },
            cliente: clienteConnect,
            horaVenta: new Date(),
            totalVenta: toNumber4(totalVenta), // ← era Decimal, ahora number
            imei,
            sucursal: { connect: { id: sucursalId } },
            productos: {
              create: consolidados.map((x) => ({
                producto: { connect: { id: x.productoId } },
                presentacionId: x.presentacionId ?? undefined,
                cantidad: x.cantidadPresentacion,
                // ← AQUI el fix principal
                precioVenta: toNumber4(x.precioVenta),
              })),
            },
          },
        });

        // --- Tracker: reportamos cantidadVendida en unidades BASE (para consistencia con históricos previos)
        const resumenPorProductoBase = new Map<number, Prisma.Decimal>();
        for (const x of consolidados) {
          const base = x.factorUnidadBase.mul(x.cantidadPresentacion);
          resumenPorProductoBase.set(
            x.productoId,
            (
              resumenPorProductoBase.get(x.productoId) ?? new Prisma.Decimal(0)
            ).add(base),
          );
        }
        await this.tracker.trackerSalidaProductoVenta(
          tx,
          Array.from(resumenPorProductoBase.entries()).map(
            ([productoId, cantBase]) => ({
              productoId,
              cantidadVendida: Number(cantBase.toFixed(0)), // si tus unidades base son enteras
              cantidadAnterior: cantidadesAnteriores[productoId] ?? 0,
            }),
          ),
          sucursalId,
          usuarioId,
          venta.id,
          'SALIDA_VENTA',
          `Registro generado por venta número #${venta.id}`,
        );

        // --- Pago (Decimal)
        const pago = await tx.pago.create({
          data: {
            metodoPago: metodoPago || 'CONTADO',
            monto: Number(totalVenta), // Decimal
            venta: { connect: { id: venta.id } },
          },
        });
        await tx.venta.update({
          where: { id: venta.id },
          data: { metodoPago: { connect: { id: pago.id } } },
        });

        // --- Caja
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
      console.error('Error en createVenta:', e);
      if (e instanceof HttpException) throw e;
      throw new InternalServerErrorException('Fatal error:Error inesperado');
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
