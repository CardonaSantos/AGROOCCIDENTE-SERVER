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
import { Prisma } from '@prisma/client';
import { HistorialStockTrackerService } from 'src/historial-stock-tracker/historial-stock-tracker.service';
import { CreateRequisicionRecepcionLineaDto } from 'src/recepcion-requisiciones/dto/requisicion-recepcion-create.dto';
import { SoloIDProductos } from 'src/recepcion-requisiciones/dto/create-venta-tracker.dto';
import { CajaService } from 'src/caja/caja.service';
import { SelectTypeVentas } from './select/selecSalesType';
import { QueryVentasTable } from './query/queryTableVentas';
import { normalizerVentas } from './helpers/normailizerVenta';
import { normalizeVentaForPDF } from './helpers/venta-pdf.normalizer';
// ===== Tipos auxiliares
import * as dayjs from 'dayjs';
import 'dayjs/locale/es';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';
import * as isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import * as isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import * as customParseFormat from 'dayjs/plugin/customParseFormat';
dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.locale('es');

type LineaProd = {
  productoId: number;
  cantidad: number;
  precioVenta: Prisma.Decimal;
  tipoPrecio: string;
  selectedPriceId: number;
};

type LineaPres = {
  presentacionId: number;
  productoId: number; // dueño de la presentación
  cantidad: number;
  precioVenta: Prisma.Decimal;
  tipoPrecio: string;
  selectedPriceId: number;
};

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

  async create(createVentaDto: CreateVentaDto, tx: Prisma.TransactionClient) {
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

    this.logger.log(
      `DTO recibido en generar ventas:\n${JSON.stringify(createVentaDto, null, 2)}`,
    );

    const referenciaPagoValid =
      referenciaPago && referenciaPago.trim() !== ''
        ? referenciaPago.trim()
        : null;

    try {
      // ===== Usuarios para notificaciones
      const usuariosNotif = await tx.usuario.findMany({
        where: { rol: { in: ['ADMIN', 'VENDEDOR'] } },
      });
      const usuariosNotifIds = usuariosNotif.map((u) => u.id);

      // ===== Cliente
      let clienteConnect: { connect: { id: number } } | undefined;
      if (clienteId) {
        clienteConnect = { connect: { id: clienteId } };
      } else if (nombre) {
        const nuevo = await tx.cliente.create({
          data: { nombre, dpi, telefono, direccion, observaciones, apellidos },
        });
        clienteConnect = { connect: { id: nuevo.id } };
      }

      const prodValidadas: LineaProd[] = [];
      const presValidadas: LineaPres[] = [];
      type LineaEntrada = (typeof productos)[number];

      // ===== Validar cada línea contra el precio seleccionado
      for (const p of productos as LineaEntrada[]) {
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
            `Precio no válido (#${p.selectedPriceId}).`,
          );
        }

        const cantidad = Number(p.cantidad ?? 0);
        if (!Number.isFinite(cantidad) || cantidad <= 0) {
          throw new BadRequestException(
            `Cantidad inválida en una de las líneas.`,
          );
        }

        // PRESENTACIÓN
        if (precio.presentacionId) {
          const presentacionId = Number(precio.presentacionId);

          if (p.presentacionId && p.presentacionId !== presentacionId) {
            throw new BadRequestException(
              `El precio #${precio.id} no corresponde a la presentación indicada (${p.presentacionId}).`,
            );
          }

          const pres = await tx.productoPresentacion.findUnique({
            where: { id: presentacionId },
            select: { id: true, productoId: true },
          });
          if (!pres) {
            throw new BadRequestException(
              `Presentación ${presentacionId} no existe.`,
            );
          }

          presValidadas.push({
            presentacionId,
            productoId: pres.productoId,
            cantidad,
            precioVenta: precio.precio as Prisma.Decimal,
            tipoPrecio: precio.tipo as unknown as string,
            selectedPriceId: p.selectedPriceId,
          });
          continue;
        }

        // PRODUCTO
        if (precio.productoId) {
          const productoId = Number(precio.productoId);

          if (p.productoId && p.productoId !== productoId) {
            throw new BadRequestException(
              `El precio #${precio.id} no corresponde al producto indicado (${p.productoId}).`,
            );
          }

          prodValidadas.push({
            productoId,
            cantidad,
            precioVenta: precio.precio as Prisma.Decimal,
            tipoPrecio: precio.tipo as unknown as string,
            selectedPriceId: p.selectedPriceId,
          });
          continue;
        }

        throw new BadRequestException(
          `Precio #${p.selectedPriceId} sin entidad asociada.`,
        );
      }

      // ===== Consolidar líneas (productoId,selectedPriceId) y (presentacionId,selectedPriceId)
      const keyProd = (x: LineaProd) => `${x.productoId}|${x.selectedPriceId}`;
      const keyPres = (x: LineaPres) =>
        `${x.presentacionId}|${x.selectedPriceId}`;

      const mapProd = new Map<string, LineaProd>();
      for (const cur of prodValidadas) {
        const k = keyProd(cur);
        const ex = mapProd.get(k);
        if (ex) ex.cantidad += cur.cantidad;
        else mapProd.set(k, { ...cur });
      }
      const prodConsolidadas = Array.from(mapProd.values());

      const mapPres = new Map<string, LineaPres>();
      for (const cur of presValidadas) {
        const k = keyPres(cur);
        const ex = mapPres.get(k);
        if (ex) ex.cantidad += cur.cantidad;
        else mapPres.set(k, { ...cur });
      }
      const presConsolidadas = Array.from(mapPres.values());

      // ===== Fotos de stock anterior
      const cantidadesAnterioresProd: Record<number, number> = {};
      const unicProdIds = Array.from(
        new Set(prodConsolidadas.map((x) => x.productoId)),
      );
      for (const pid of unicProdIds) {
        const agg = await tx.stock.aggregate({
          where: { productoId: pid, sucursalId },
          _sum: { cantidad: true },
        });
        cantidadesAnterioresProd[pid] = agg._sum.cantidad ?? 0;
      }

      const cantidadesAnterioresPres: Record<number, number> = {};
      const unicPresIds = Array.from(
        new Set(presConsolidadas.map((x) => x.presentacionId)),
      );
      for (const prId of unicPresIds) {
        const agg = await tx.stockPresentacion.aggregate({
          where: { presentacionId: prId, sucursalId },
          _sum: { cantidadPresentacion: true },
        });
        cantidadesAnterioresPres[prId] = agg._sum.cantidadPresentacion ?? 0;
      }

      // ===== Descontar STOCK (Producto -> Stock; Presentación -> StockPresentacion)
      // Producto: FIFO
      for (const linea of prodConsolidadas) {
        let restante = linea.cantidad;
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
          throw new BadRequestException(
            `Stock insuficiente para producto ${linea.productoId}.`,
          );
        }
      }

      // Presentación: FIFO
      for (const linea of presConsolidadas) {
        let restante = linea.cantidad;
        const lotes = await tx.stockPresentacion.findMany({
          where: {
            presentacionId: linea.presentacionId,
            sucursalId,
            cantidadPresentacion: { gt: 0 },
          },
          orderBy: { fechaIngreso: 'asc' },
        });
        for (const lote of lotes) {
          if (restante <= 0) break;
          const usar = Math.min(restante, lote.cantidadPresentacion);
          await tx.stockPresentacion.update({
            where: { id: lote.id },
            data: { cantidadPresentacion: { decrement: usar } },
          });
          restante -= usar;
        }
        if (restante > 0) {
          throw new BadRequestException(
            `Stock insuficiente para presentación ${linea.presentacionId}.`,
          );
        }
      }

      // ===== Notificaciones stock bajo
      // ===== Notificaciones stock bajo (enviar 1 sola vez al CRUZAR el umbral y sin duplicados)
      for (const prodId of unicProdIds) {
        // Calcular stock actual, threshold y nombre en paralelo
        const [agg, th, info] = await Promise.all([
          tx.stock.aggregate({
            where: { productoId: prodId, sucursalId },
            _sum: { cantidad: true },
          }),
          tx.stockThreshold.findUnique({ where: { productoId: prodId } }),
          tx.producto.findUnique({
            where: { id: prodId },
            select: { nombre: true },
          }),
        ]);
        if (!th) continue;

        const stockGlobal = agg._sum.cantidad ?? 0;

        // ✅ Notificar SOLO si se CRUZA el umbral (antes > mínimo && ahora <= mínimo)
        const antes = cantidadesAnterioresProd[prodId] ?? stockGlobal;
        const cruzoUmbral =
          antes > th.stockMinimo && stockGlobal <= th.stockMinimo;
        if (!cruzoUmbral) continue;

        // Objetivo real de destinatarios (usa lo que calculaste arriba)
        const targetIds = usuariosNotifIds; // p.ej. ADMIN + VENDEDOR

        // ¿Existe ya una notificación (para este threshold) que podamos reutilizar?
        const existente = await tx.notificacion.findFirst({
          where: {
            categoria: 'INVENTARIO',
            referenciaId: th.id, // usa el ID del threshold como referencia estable
          },
          include: { notificacionesUsuarios: { select: { usuarioId: true } } },
        });

        // Adjuntar solo quienes no la tienen
        const yaAsociados = new Set(
          existente?.notificacionesUsuarios.map((nu) => nu.usuarioId) ?? [],
        );
        const faltantes = targetIds.filter((id) => !yaAsociados.has(id));
        if (faltantes.length === 0 && existente) continue;

        const titulo = `Stock mínimo de ${info?.nombre ?? prodId} alcanzado`;
        const mensaje = `El producto ${info?.nombre ?? prodId} ha alcanzado el stock mínimo (quedan ${stockGlobal} uds).`;

        if (!existente) {
          // Crear UNA notificación y ligarla a TODOS los destinatarios objetivo
          await this.notifications.createForUsers({
            titulo,
            mensaje,
            userIds: targetIds,
            categoria: 'INVENTARIO',
            referenciaId: th.id,
            // si tu servicio usa más campos (audiencia/categoria/severidad), añádelos aquí
          });
        } else {
          // Solo crear vínculos faltantes (evita duplicados)
          await tx.notificacionesUsuarios.createMany({
            data: faltantes.map((usuarioId) => ({
              usuarioId,
              notificacionId: existente.id,
            })),
            skipDuplicates: true,
          });
        }
      }

      // ===== Totales
      const totalVentaProd = prodConsolidadas.reduce(
        (sum, x) => sum.add(x.precioVenta.mul(x.cantidad)),
        new Prisma.Decimal(0),
      );
      const totalVentaPres = presConsolidadas.reduce(
        (sum, x) => sum.add(x.precioVenta.mul(x.cantidad)),
        new Prisma.Decimal(0),
      );
      const totalVenta = totalVentaProd.add(totalVentaPres);

      // ===== Crear venta + líneas
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
            create: [
              ...prodConsolidadas.map((x) => ({
                producto: { connect: { id: x.productoId } },
                cantidad: x.cantidad,
                precioVenta: toNumber4(x.precioVenta),
              })),
              ...presConsolidadas.map((x) => ({
                producto: { connect: { id: x.productoId } },
                presentacion: { connect: { id: x.presentacionId } },
                cantidad: x.cantidad,
                precioVenta: toNumber4(x.precioVenta),
              })),
            ],
          },
        },
      });
      this.logger.log('La venta es: ', venta);

      // ===== Trackers
      if (prodConsolidadas.length) {
        await this.tracker.trackerSalidaProductoVenta(
          tx,
          prodConsolidadas.map((x) => ({
            productoId: x.productoId,
            cantidadVendida: x.cantidad,
            cantidadAnterior: cantidadesAnterioresProd[x.productoId] ?? 0,
          })),
          sucursalId,
          usuarioId,
          venta.id,
          'SALIDA_VENTA',
          `Registro generado por venta #${venta.id}`,
        );
      }

      if (
        presConsolidadas.length &&
        (this.tracker as any).trackerSalidaPresentacionVenta
      ) {
        await (this.tracker as any).trackerSalidaPresentacionVenta(
          tx,
          presConsolidadas.map((x) => ({
            presentacionId: x.presentacionId,
            productoId: x.productoId,
            cantidadVendida: x.cantidad,
            cantidadAnterior: cantidadesAnterioresPres[x.presentacionId] ?? 0,
          })),
          sucursalId,
          usuarioId,
          venta.id,
          'SALIDA_VENTA',
          `Registro generado por venta #${venta.id}`,
        );
      }

      // Pago + vincular a venta
      if (metodoPago && metodoPago !== 'CREDITO') {
        const pago = await tx.pago.create({
          data: {
            metodoPago,
            monto: Number(totalVenta),
            venta: { connect: { id: venta.id } },
          },
        });
        await tx.venta.update({
          where: { id: venta.id },
          data: { metodoPago: { connect: { id: pago.id } } },
        });

        await this.cajaService.attachAndRecordSaleTx(
          tx,
          venta.id,
          sucursalId,
          usuarioId,
          { exigirCajaSiEfectivo: true },
        );
      } else {
        // Crédito: opcional, crear pago marcador 0 si tu UI lo espera
        const pago0 = await tx.pago.create({
          data: {
            metodoPago: 'CREDITO',
            monto: 0,
            venta: { connect: { id: venta.id } },
          },
        });
        await tx.venta.update({
          where: { id: venta.id },
          data: { metodoPago: { connect: { id: pago0.id } } },
        });
      }

      //  Caja
      await this.cajaService.attachAndRecordSaleTx(
        tx,
        venta.id,
        sucursalId,
        usuarioId,
        { exigirCajaSiEfectivo: true },
      );

      return venta;
    } catch (e) {
      this.logger.error('Error en createVenta:', e);
      if (e instanceof HttpException) throw e;
      throw new InternalServerErrorException('Fatal error: Error inesperado');
    }
  }

  async createVentaTx(dto: CreateVentaDto, tx?: Prisma.TransactionClient) {
    if (tx) return this.create(dto, tx);
    return this.prisma.$transaction(async (t) => this.create(dto, t));
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

  async findAllSaleSucursal(query: QueryVentasTable) {
    try {
      const {
        sucursalId,
        page = 1,
        limit = 20,
        sortBy = 'fechaVenta',
        sortDir = 'desc',
        nombreCliente,
        telefonoCliente,
        referenciaPago,
        codigoItem,
        texto,
        fechaDesde,
        fechaHasta,
        montoMin,
        montoMax,
        cats,
        metodoPago,
        tipoComprobante,
        isVendedor,
        usuarioId,
      } = query;

      if (!sucursalId) {
        throw new BadRequestException('sucursalId es requerido');
      }

      this.logger.log(
        `DTO recibido query ventas historial, M:Ventas ==>:\n${JSON.stringify(query, null, 2)}`,
      );

      const AND: Prisma.VentaWhereInput[] = [{ sucursalId, anulada: false }];

      if (isVendedor) {
        AND.push({
          usuarioId: usuarioId,
        });
      }
      // rango de fechas
      // rango de fechas (INCLUYENTE en días)
      if (fechaDesde || fechaHasta) {
        const start = fechaDesde
          ? dayjs(fechaDesde).startOf('day').toDate()
          : undefined;

        // end exclusivo: inicio del día siguiente
        const endExclusive = fechaHasta
          ? dayjs(fechaHasta).add(1, 'day').startOf('day').toDate()
          : undefined;

        AND.push({
          fechaVenta: {
            ...(start && { gte: start }),
            ...(endExclusive && { lt: endExclusive }), // <--- lt, NO lte
          },
        });
      }

      // montos
      if (montoMin != null || montoMax != null) {
        AND.push({
          totalVenta: {
            gte: montoMin ?? undefined,
            lte: montoMax ?? undefined,
          },
        });
      }

      // nombre/telefono cliente y/o cliente final
      if (nombreCliente) {
        AND.push({
          OR: [
            {
              cliente: {
                nombre: { contains: nombreCliente, mode: 'insensitive' },
              },
            },
            {
              nombreClienteFinal: {
                contains: nombreCliente,
                mode: 'insensitive',
              },
            },
          ],
        });
      }

      if (telefonoCliente) {
        AND.push({
          OR: [
            {
              cliente: {
                telefono: { contains: telefonoCliente, mode: 'insensitive' },
              },
            },
            {
              telefonoClienteFinal: {
                contains: telefonoCliente,
                mode: 'insensitive',
              },
            },
          ],
        });
      }

      // referencia pago
      if (referenciaPago) {
        AND.push({
          referenciaPago: { contains: referenciaPago, mode: 'insensitive' },
        });
      }

      // código de item (producto o presentación)
      if (codigoItem) {
        AND.push({
          productos: {
            some: {
              OR: [
                {
                  producto: {
                    codigoProducto: {
                      contains: codigoItem,
                      mode: 'insensitive',
                    },
                  },
                },
                {
                  presentacion: {
                    codigoBarras: { contains: codigoItem, mode: 'insensitive' },
                  },
                },
              ],
            },
          },
        });
      }

      // categorías de productos
      if (cats?.length) {
        AND.push({
          productos: {
            some: {
              producto: {
                categorias: {
                  some: { id: { in: cats } },
                },
              },
            },
          },
        });
      }

      // método(s) de pago
      if (metodoPago?.length) {
        AND.push({
          metodoPago: {
            is: {
              metodoPago: { in: metodoPago },
            },
          },
        });
      }

      // tipo(s) de comprobante
      if (tipoComprobante?.length) {
        AND.push({
          tipoComprobante: { in: tipoComprobante },
        });
      }

      // búsqueda libre "texto"
      if (texto) {
        AND.push({
          OR: [
            { cliente: { nombre: { contains: texto, mode: 'insensitive' } } },
            { nombreClienteFinal: { contains: texto, mode: 'insensitive' } },
            { referenciaPago: { contains: texto, mode: 'insensitive' } },
            {
              productos: {
                some: {
                  producto: {
                    nombre: { contains: texto, mode: 'insensitive' },
                  },
                },
              },
            },
            {
              productos: {
                some: {
                  presentacion: {
                    nombre: { contains: texto, mode: 'insensitive' },
                  },
                },
              },
            },
            {
              productos: {
                some: {
                  producto: {
                    codigoProducto: { contains: texto, mode: 'insensitive' },
                  },
                },
              },
            },
            {
              productos: {
                some: {
                  presentacion: {
                    codigoBarras: { contains: texto, mode: 'insensitive' },
                  },
                },
              },
            },
          ],
        });
      }

      const where: Prisma.VentaWhereInput = { AND };

      // ordenamiento
      const orderBy: Prisma.VentaOrderByWithRelationInput[] = [];
      if (sortBy === 'clienteNombre') {
        orderBy.push({ cliente: { nombre: sortDir } as any });
      } else {
        orderBy.push({ [sortBy]: sortDir });
      }

      const skip = (page - 1) * limit;
      const take = limit;

      // query principal
      const [ventas, total] = await this.prisma.$transaction([
        this.prisma.venta.findMany({
          where,
          orderBy,
          skip,
          take,
          select: SelectTypeVentas,
        }),
        this.prisma.venta.count({ where }),
      ]);

      return {
        data: normalizerVentas(ventas), // la UI puede normalizar, o lo normalizamos aquí (abajo te doy un normalizador)
        meta: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
          hasNext: skip + ventas.length < total,
          hasPrev: page > 1,
          sortBy,
          sortDir,
        },
      };
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Error al obtener las ventas');
    }
  }

  async findOneSale(id: number) {
    try {
      const venta = await this.prisma.venta.findUnique({
        where: { id },
        include: {
          cliente: true,
          metodoPago: true, // puede ser objeto o array según tu modelo
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
              // 👇 incluimos ambas caras para poder normalizar
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
              presentacion: {
                select: {
                  id: true,
                  nombre: true,
                  descripcion: true,
                  codigoBarras: true,
                  creadoEn: true,
                  actualizadoEn: true,
                },
              },
            },
            orderBy: { id: 'asc' },
          },
        },
      });

      if (!venta) return null;

      return normalizeVentaForPDF(venta);
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Error al obtener la venta');
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
