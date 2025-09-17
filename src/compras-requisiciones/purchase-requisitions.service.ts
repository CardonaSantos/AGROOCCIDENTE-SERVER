import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreatePurchaseRequisitionDto } from './dto/create-purchase-requisition.dto';
import { UpdatePurchaseRequisitionDto } from './dto/update-purchase-requisition.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import * as dayjs from 'dayjs';
import 'dayjs/locale/es';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';
import * as isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import * as isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import { TZGT } from 'src/utils/utils';
import { MetodoPago, Prisma, TipoMovimientoStock } from '@prisma/client';
import { ComprasRegistrosQueryDto } from './dto/compras-registros.query.dto';
import {
  CreateRequisicionRecepcionDto,
  CreateRequisicionRecepcionLineaDto,
} from 'src/recepcion-requisiciones/dto/requisicion-recepcion-create.dto';
import { EntregaStockData } from 'src/utilities/utils';
import { UtilitiesService } from 'src/utilities/utilities.service';
import { HistorialStockTrackerService } from 'src/historial-stock-tracker/historial-stock-tracker.service';
import { RecepcionarCompraAutoDto } from './dto/compra-recepcion.dto';
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.locale('es');

@Injectable()
export class PurchaseRequisitionsService {
  private readonly logger = new Logger(PurchaseRequisitionsService.name);
  constructor(
    private readonly prisma: PrismaService,

    private readonly utilities: UtilitiesService,
    private readonly tracker: HistorialStockTrackerService,
  ) {}

  create(createPurchaseRequisitionDto: CreatePurchaseRequisitionDto) {
    return 'This action adds a new purchaseRequisition';
  }

  /**
   *
   * @param q Queries para el filtrado
   * @returns
   */
  async getRegistrosCompras(q: ComprasRegistrosQueryDto) {
    try {
      const page = Number(q.page ?? 1) || 1;
      const limit = Math.max(1, Math.min(Number(q.limit ?? 10) || 10, 100));
      const skip = (page - 1) * limit;

      const {
        sucursalId,
        estado,
        proveedorId,
        conFactura,
        fechaInicio,
        fechaFin,
        creadoInicio,
        creadoFin,
        minTotal,
        maxTotal,
        search,
        orderBy = 'fecha',
        order = 'desc',
        groupByProveedor,
        withDetalles = true,
      } = q;

      // ---- WHERE para detalles
      // ▶ ahora también buscamos por presentacion.nombre / sku / codigoBarras
      const detalleWhere: Prisma.CompraDetalleWhereInput = search
        ? {
            OR: [
              // Producto
              {
                producto: { nombre: { contains: search, mode: 'insensitive' } },
              },
              {
                producto: {
                  codigoProducto: { contains: search, mode: 'insensitive' },
                },
              },
              // Presentación
              {
                presentacion: {
                  nombre: { contains: search, mode: 'insensitive' },
                },
              },
              {
                presentacion: {
                  sku: { contains: search, mode: 'insensitive' },
                },
              },
              {
                presentacion: {
                  codigoBarras: { contains: search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {};

      const hasDetalleSearch = !!search;

      // ---- WHERE principal
      const where: Prisma.CompraWhereInput = {
        ...(sucursalId ? { sucursalId: Number(sucursalId) } : {}),
        ...(estado ? { estado } : {}),
        ...(typeof proveedorId === 'number' ? { proveedorId } : {}),
        ...(typeof conFactura === 'boolean' ? { conFactura } : {}),
        ...(fechaInicio || fechaFin
          ? {
              fecha: {
                ...(fechaInicio ? { gte: new Date(fechaInicio) } : {}),
                ...(fechaFin ? { lte: new Date(fechaFin) } : {}),
              },
            }
          : {}),
        ...(creadoInicio || creadoFin
          ? {
              creadoEn: {
                ...(creadoInicio ? { gte: new Date(creadoInicio) } : {}),
                ...(creadoFin ? { lte: new Date(creadoFin) } : {}),
              },
            }
          : {}),
        ...(minTotal || maxTotal
          ? {
              total: {
                ...(typeof minTotal === 'number' ? { gte: minTotal } : {}),
                ...(typeof maxTotal === 'number' ? { lte: maxTotal } : {}),
              },
            }
          : {}),
        ...(search
          ? {
              OR: [
                { facturaNumero: { contains: search, mode: 'insensitive' } },
                {
                  proveedor: {
                    nombre: { contains: search, mode: 'insensitive' },
                  },
                },
                {
                  requisicion: {
                    folio: { contains: search, mode: 'insensitive' },
                  },
                },
                {
                  usuario: {
                    OR: [
                      { nombre: { contains: search, mode: 'insensitive' } },
                      { correo: { contains: search, mode: 'insensitive' } },
                    ],
                  },
                },
                // Búsqueda en productos/presentaciones a través de detalles
                { detalles: { some: detalleWhere } },
              ],
            }
          : {}),
        ...(hasDetalleSearch ? { detalles: { some: detalleWhere } } : {}),
      };

      // ---- Orden
      const orderByObj: Prisma.CompraOrderByWithRelationInput =
        orderBy === 'total'
          ? { total: order }
          : orderBy === 'creadoEn'
            ? { creadoEn: order }
            : { fecha: order }; // default

      // ---- SELECT (withDetalles para aligerar)
      const baseSelect = {
        id: true,
        creadoEn: true,
        actualizadoEn: true,
        conFactura: true,
        estado: true,
        facturaFecha: true,
        facturaNumero: true,
        total: true,
        fecha: true,
        proveedor: { select: { id: true, nombre: true } },
        usuario: { select: { id: true, nombre: true, correo: true } },
        pedido: { select: { id: true, folio: true } },
        requisicion: {
          select: {
            id: true,
            folio: true,
            estado: true,
            fecha: true,
            totalLineas: true,
            usuario: { select: { id: true, nombre: true, correo: true } },
            createdAt: true,
            updatedAt: true,
          },
        },
      } as const;

      // ▶ detallesSelect ahora incluye presentacion
      const detallesSelect = {
        detalles: {
          orderBy: { cantidad: 'desc' },
          select: {
            id: true,
            creadoEn: true,
            actualizadoEn: true,
            cantidad: true,
            costoUnitario: true,
            producto: {
              select: {
                id: true,
                nombre: true,
                codigoProducto: true,
                precioCostoActual: true,
              },
            },
            presentacion: {
              select: {
                id: true,
                nombre: true,
                sku: true,
                codigoBarras: true,
                tipoPresentacion: true,
                factorUnidadBase: true, // Decimal
                costoReferencialPresentacion: true, // Decimal?
              },
            },
          },
        },
      } as const;

      // ---- Query
      const [total, compras] = await this.prisma.$transaction([
        this.prisma.compra.count({ where }),
        this.prisma.compra.findMany({
          where,
          take: limit,
          skip,
          orderBy: orderByObj,
          select: withDetalles
            ? { ...baseSelect, ...detallesSelect }
            : baseSelect,
        }),
      ]);

      // Helper: Decimal|number|null → number
      const toNum = (v: any, fallback = 0): number => {
        if (v == null) return fallback;
        if (typeof v === 'number') return v;
        if (typeof v === 'string') return parseFloat(v);
        // Prisma.Decimal u otros
        return parseFloat(v.toString?.() ?? `${fallback}`);
      };

      // ---- Mapping seguro para UI (ahora con presentacion)
      const items = compras.map((c) => {
        const folioOrigen =
          (c as any).requisicion?.folio ?? (c as any).pedido?.folio ?? null;
        const tipoOrigen = (c as any).requisicion
          ? 'REQUISICION'
          : (c as any).pedido
            ? 'PEDIDO'
            : 'DIRECTA';

        const detalles = (
          withDetalles ? ((c as any).detalles ?? []) : []
        ) as Array<{
          id: number;
          creadoEn: Date | null;
          actualizadoEn: Date | null;
          cantidad: number | null;
          costoUnitario: number | null;
          producto?: {
            id?: number;
            nombre?: string;
            codigoProducto?: string;
            precioCostoActual?: number | null;
          } | null;
          presentacion?: {
            id: number;
            nombre: string | null;
            sku: string | null;
            codigoBarras: string | null;
            tipoPresentacion: string | null;
            factorUnidadBase: any; // Decimal
            costoReferencialPresentacion: any; // Decimal
          } | null;
        }>;

        const detallesUI = detalles.map((d) => {
          const costoUnitario = toNum(
            d.costoUnitario,
            toNum(d.producto?.precioCostoActual, 0),
          );
          const cantidad = d.cantidad ?? 0;

          // ▶ desbloqueamos datos de presentación para la UI
          const pres = d.presentacion
            ? {
                id: d.presentacion.id,
                nombre: d.presentacion.nombre ?? '',
                sku: d.presentacion.sku ?? null,
                codigoBarras: d.presentacion.codigoBarras ?? null,
                tipoPresentacion: d.presentacion.tipoPresentacion ?? null,
                factorUnidadBase: toNum(d.presentacion.factorUnidadBase, 1),
                costoReferencialPresentacion: toNum(
                  d.presentacion.costoReferencialPresentacion,
                  0,
                ),
              }
            : null;

          return {
            id: d.id,
            cantidad,
            costoUnitario,
            subtotal: cantidad * costoUnitario,
            creadoEn: (d.creadoEn as any)?.toISOString?.() ?? null,
            actualizadoEn: (d.actualizadoEn as any)?.toISOString?.() ?? null,
            producto: {
              id: d.producto?.id ?? null,
              nombre: d.producto?.nombre ?? '',
              codigo: d.producto?.codigoProducto ?? '',
              precioCostoActual: d.producto?.precioCostoActual ?? null,
            },
            presentacion: pres, // ▶ nuevo bloque en el detalle
          };
        });

        const resumen = detallesUI.reduce(
          (acc, it) => {
            acc.items += 1;
            acc.cantidadTotal += it.cantidad;
            acc.subtotal += it.subtotal;
            return acc;
          },
          { items: 0, cantidadTotal: 0, subtotal: 0 },
        );

        return {
          id: (c as any).id,
          estado: (c as any).estado ?? 'ESPERANDO_ENTREGA',
          total: (c as any).total ?? resumen.subtotal,
          fecha: ((c as any).fecha as any)?.toISOString?.() ?? null,

          folioOrigen,
          tipoOrigen,

          conFactura: !!(c as any).conFactura,
          proveedor: (c as any).proveedor
            ? {
                id: (c as any).proveedor.id,
                nombre: (c as any).proveedor.nombre,
              }
            : null,
          factura: (c as any).conFactura
            ? {
                numero: (c as any).facturaNumero ?? null,
                fecha:
                  ((c as any).facturaFecha as any)?.toISOString?.() ?? null,
              }
            : null,
          usuario: {
            id: (c as any).usuario?.id ?? null,
            nombre: (c as any).usuario?.nombre ?? '',
            correo: (c as any).usuario?.correo ?? '',
          },
          pedido: (c as any).pedido
            ? { id: (c as any).pedido.id, folio: (c as any).pedido.folio }
            : {},
          requisicion: (c as any).requisicion
            ? {
                id: (c as any).requisicion.id,
                folio: (c as any).requisicion.folio ?? (c as any).pedido?.folio,
                estado: (c as any).requisicion.estado ?? 'PENDIENTE',
                fecha:
                  ((c as any).requisicion.fecha as any)?.toISOString?.() ??
                  null,
                totalLineas: (c as any).requisicion.totalLineas ?? 0,
                usuario: {
                  id: (c as any).requisicion.usuario?.id ?? null,
                  nombre: (c as any).requisicion.usuario?.nombre ?? '',
                  correo: (c as any).requisicion.usuario?.correo ?? '',
                },
                createdAt:
                  ((c as any).requisicion.createdAt as any)?.toISOString?.() ??
                  null,
                updatedAt:
                  ((c as any).requisicion.updatedAt as any)?.toISOString?.() ??
                  null,
              }
            : null,
          creadoEn: ((c as any).creadoEn as any)?.toISOString?.() ?? null,
          actualizadoEn:
            ((c as any).actualizadoEn as any)?.toISOString?.() ?? null,

          detalles: detallesUI,
          resumen,
        };
      });

      if (groupByProveedor) {
        const agrupado = items.reduce<
          Record<
            string,
            {
              proveedor: { id: number | null; nombre: string };
              registros: typeof items;
            }
          >
        >((acc, it) => {
          const key = String(it.proveedor?.id ?? 'SIN_PROVEEDOR');
          if (!acc[key]) {
            acc[key] = {
              proveedor: {
                id: it.proveedor?.id ?? null,
                nombre: it.proveedor?.nombre ?? '—',
              },
              registros: [] as any,
            };
          }
          acc[key].registros.push(it);
          return acc;
        }, {});

        return {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
          itemsByProveedor: Object.values(agrupado),
        };
      }

      return {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
        items,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'Error inesperado en listado de compras',
      );
    }
  }

  /**
   *
   * @param compraID ID de compra unitaria
   * @returns
   */
  async getRegistroCompra(compraID: number) {
    try {
      if (!compraID || Number.isNaN(compraID)) {
        throw new BadRequestException('ID de compra inválido');
      }

      const c = await this.prisma.compra.findUnique({
        where: { id: compraID },
        include: {
          proveedor: { select: { id: true, nombre: true } },
          sucursal: { select: { id: true, nombre: true } },
          usuario: { select: { id: true, nombre: true, correo: true } },
          requisicion: {
            select: {
              id: true,
              folio: true,
              estado: true,
              fecha: true,
              totalLineas: true,
              createdAt: true,
              updatedAt: true,
              usuario: { select: { id: true, nombre: true, correo: true } },
            },
          },
          pedido: {
            select: {
              id: true,
              folio: true,
              fecha: true,
              estado: true,
              prioridad: true,
              tipo: true,
              observaciones: true,
              usuario: { select: { id: true, nombre: true, correo: true } },
              cliente: { select: { id: true, nombre: true } },
            },
          },
          // ▶ DETALLES con PRESENTACIÓN
          detalles: {
            orderBy: { cantidad: 'desc' },
            select: {
              id: true,
              creadoEn: true,
              actualizadoEn: true,
              cantidad: true,
              costoUnitario: true,
              producto: {
                select: {
                  id: true,
                  nombre: true,
                  codigoProducto: true,
                  precioCostoActual: true,
                },
              },
              presentacion: {
                select: {
                  id: true,
                  nombre: true,
                  sku: true,
                  codigoBarras: true,
                  tipoPresentacion: true,
                  factorUnidadBase: true, // Decimal
                  costoReferencialPresentacion: true, // Decimal?
                },
              },
            },
          },
        },
      });

      if (!c) throw new NotFoundException('Compra no encontrada');

      // Helper: Decimal|string|number|null → number
      const toNum = (v: any, fallback = 0): number => {
        if (v == null) return fallback;
        if (typeof v === 'number') return v;
        if (typeof v === 'string') return parseFloat(v);
        return parseFloat(v?.toString?.() ?? `${fallback}`);
      };

      // ---- map null-safe a formato UI (con presentacion)
      const detalles = (c.detalles ?? []).map((d) => {
        const costoUnitario = toNum(
          d.costoUnitario,
          toNum(d.producto?.precioCostoActual, 0),
        );
        const cantidad = d.cantidad ?? 0;

        const presentacion = d.presentacion
          ? {
              id: d.presentacion.id,
              nombre: d.presentacion.nombre ?? '',
              sku: d.presentacion.sku ?? null,
              codigoBarras: d.presentacion.codigoBarras ?? null,
              tipoPresentacion: d.presentacion.tipoPresentacion ?? null,
              factorUnidadBase: toNum(d.presentacion.factorUnidadBase, 1),
              costoReferencialPresentacion: toNum(
                d.presentacion.costoReferencialPresentacion,
                0,
              ),
            }
          : null;

        return {
          id: d.id,
          cantidad,
          costoUnitario, // costo por PRESENTACIÓN
          subtotal: cantidad * costoUnitario,
          creadoEn: (d.creadoEn as any)?.toISOString?.() ?? null,
          actualizadoEn: (d.actualizadoEn as any)?.toISOString?.() ?? null,
          producto: {
            id: d.producto?.id ?? null,
            nombre: d.producto?.nombre ?? '',
            codigo: d.producto?.codigoProducto ?? '',
            precioCostoActual: d.producto?.precioCostoActual ?? null,
          },
          presentacion, // ▶ nuevo bloque
        };
      });

      const resumen = detalles.reduce(
        (acc, it) => {
          acc.items += 1;
          acc.cantidadTotal += it.cantidad;
          acc.subtotal += it.subtotal;
          return acc;
        },
        { items: 0, cantidadTotal: 0, subtotal: 0 },
      );

      const resp = {
        id: c.id,
        estado: c.estado ?? 'ESPERANDO_ENTREGA',
        fecha: (c.fecha as any)?.toISOString?.() ?? null,
        total: c.total ?? resumen.subtotal,
        conFactura: !!c.conFactura,

        factura: c.conFactura
          ? {
              numero: c.facturaNumero ?? null,
              fecha: (c.facturaFecha as any)?.toISOString?.() ?? null,
            }
          : null,

        origen: c.origen, // DB
        folioOrigen: c.requisicion?.folio ?? c.pedido?.folio ?? null,

        proveedor: c.proveedor
          ? { id: c.proveedor.id, nombre: c.proveedor.nombre }
          : null,
        sucursal: c.sucursal
          ? { id: c.sucursal.id, nombre: c.sucursal.nombre }
          : null,
        usuario: {
          id: c.usuario?.id ?? null,
          nombre: c.usuario?.nombre ?? '',
          correo: c.usuario?.correo ?? '',
        },

        requisicion: c.requisicion
          ? {
              id: c.requisicion.id,
              folio: c.requisicion.folio ?? '',
              estado: c.requisicion.estado ?? 'PENDIENTE',
              fecha: (c.requisicion.fecha as any)?.toISOString?.() ?? null,
              totalLineas: c.requisicion.totalLineas ?? 0,
              createdAt:
                (c.requisicion.createdAt as any)?.toISOString?.() ?? null,
              updatedAt:
                (c.requisicion.updatedAt as any)?.toISOString?.() ?? null,
              usuario: {
                id: c.requisicion.usuario?.id ?? null,
                nombre: c.requisicion.usuario?.nombre ?? '',
                correo: c.requisicion.usuario?.correo ?? '',
              },
            }
          : null,

        pedido:
          !c.requisicion && c.pedido
            ? {
                id: c.pedido.id,
                folio: c.pedido.folio,
                estado: c.pedido.estado,
                fecha: (c.pedido.fecha as any)?.toISOString?.() ?? null,
                prioridad: c.pedido.prioridad,
                tipo: c.pedido.tipo,
                observaciones: c.pedido.observaciones ?? '',
                usuario: {
                  id: c.pedido.usuario?.id ?? null,
                  nombre: c.pedido.usuario?.nombre ?? '',
                  correo: c.pedido.usuario?.correo ?? '',
                },
                cliente: c.pedido.cliente
                  ? { id: c.pedido.cliente.id, nombre: c.pedido.cliente.nombre }
                  : null,
              }
            : null,

        creadoEn: (c.creadoEn as any)?.toISOString?.() ?? null,
        actualizadoEn: (c.actualizadoEn as any)?.toISOString?.() ?? null,
        detalles,
        resumen,
      };

      return resp;
    } catch (error) {
      this.logger.error('El error es: ', error);
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Fatal error: Error inesperado');
    }
  }

  /**
   *
   * @param dto
   * @returns
   */
  async makeRecepcionRequisicion(dto: CreateRequisicionRecepcionDto) {
    try {
      const requisicionId = await this.prisma.compra.findUnique({
        where: {
          id: dto.compraId,
        },
        select: {
          requisicionId: true,
        },
      });

      return await this.prisma.$transaction(async (tx) => {
        const requisicionMain = await tx.requisicion.findUnique({
          where: { id: dto.requisicionId },
        });

        if (!requisicionMain) {
          throw new NotFoundException({
            message: 'Error al encontrar el registro de requisición',
          });
        }

        const newRequisicionRecepcion = await tx.requisicionRecepcion.create({
          data: {
            observaciones: dto.observaciones,
            usuario: { connect: { id: dto.usuarioId } },
            requisicion: { connect: { id: dto.requisicionId } },
          },
        });

        const lineas = await Promise.all(
          dto.lineas.map((prod) =>
            tx.requisicionRecepcionLinea.create({
              data: {
                requisicionRecepcion: {
                  connect: { id: newRequisicionRecepcion.id },
                },
                requisicionLinea: { connect: { id: prod.requisicionLineaId } },
                producto: { connect: { id: prod.productoId } },
                cantidadSolicitada: prod.cantidadSolicitada,
                cantidadRecibida: prod.cantidadRecibida,
                ingresadaAStock: prod.ingresadaAStock ?? true,
              },
            }),
          ),
        );

        await Promise.all(
          dto.lineas.map((prod) =>
            tx.requisicionLinea.update({
              where: { id: prod.requisicionLineaId },
              data: {
                cantidadRecibida: prod.cantidadRecibida,
                ingresadaAStock: true,
              },
            }),
          ),
        );

        const stockDtos = dto.lineas.map((linea) => ({
          productoId: linea.productoId,
          cantidad: linea.cantidadRecibida,
          costoTotal: (linea.precioUnitario ?? 0) * linea.cantidadRecibida,
          fechaIngreso: new Date().toISOString(),
          fechaExpiracion: linea?.fechaExpiracion ?? null,
          precioCosto: linea.precioUnitario ?? 0,
          sucursalId: requisicionMain.sucursalId,
          requisicionRecepcionId: newRequisicionRecepcion.id,
        }));

        const totalEntrega = dto.lineas.reduce(
          (accumulador: number, linea: CreateRequisicionRecepcionLineaDto) =>
            accumulador + (linea.precioUnitario ?? 0) * linea.cantidadRecibida,
          0,
        );

        let entregaStockData: EntregaStockData = {
          fechaEntrega: dayjs().tz('America/Guatemala').toDate(),
          montoTotal: totalEntrega,
          proveedorId: dto.proveedorId,
          sucursalId: dto.sucursalId,
          recibidoPorId: dto.usuarioId,
        };

        await this.tracker.trackIngresoProductos(
          tx,
          dto.lineas,
          dto.sucursalId,
          dto.usuarioId,
          dto.requisicionId,
          TipoMovimientoStock.INGRESO_REQUISICION,
          'Este comentario surge dentro de la funcion main',
        );

        const newStocks = await this.utilities.generateStockFromRequisicion(
          tx,
          stockDtos,
          entregaStockData,
        );

        if (newStocks && lineas) {
          await tx.requisicion.update({
            where: {
              id: requisicionMain.id,
            },
            data: {
              fechaRecepcion: dayjs().tz('America/Guatemala').toDate(),
              ingresadaAStock: true,
              estado: 'RECIBIDA',
            },
          });
        }

        return { newRequisicionRecepcion, lineas, newStocks };
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('El error es: ', error);
      throw new InternalServerErrorException({
        message: 'Fatal error: Error inesperado',
      });
    }
  }

  /**
   * Recepciona una COMPRA:
   * - Crea RequisicionRecepcion (si la compra proviene de una requisición)
   * - Crea RequisicionRecepcionLinea enlazando a requisicionLinea (si existe)
   * - Genera Stock (lotes) y Historial
   * - Actualiza requisicion.lineas cantidadRecibida / ingresadaAStock
   * - Ajusta estado de Compra (RECIBIDO / RECIBIDO_PARCIAL)
   */
  // async makeRecepcionCompraAuto(dto: RecepcionarCompraAutoDto) {
  //   try {
  //     this.logger.log('La data llegando es: ', dto);
  //     return await this.prisma.$transaction(async (tx) => {
  //       const compra = await tx.compra.findUnique({
  //         where: { id: dto.compraId },
  //         include: {
  //           detalles: {
  //             select: {
  //               id: true,
  //               cantidad: true,
  //               costoUnitario: true,
  //               productoId: true,
  //               requisicionLineaId: true,
  //             },
  //           },
  //           proveedor: { select: { id: true } },
  //         },
  //       });
  //       if (!compra) throw new NotFoundException('Compra no encontrada');

  //       const sucursalId = compra.sucursalId;
  //       if (!sucursalId) {
  //         throw new BadRequestException(
  //           'La compra no tiene sucursal asociada.',
  //         );
  //       }
  //       const proveedorIdEfectivo = compra.proveedorId ?? undefined;

  //       let requisicionRecepcionId: number | null = null;
  //       if (compra.requisicionId) {
  //         const reqMain = await tx.requisicion.findUnique({
  //           where: { id: compra.requisicionId },
  //         });
  //         if (!reqMain)
  //           throw new NotFoundException(
  //             'Requisición origen no encontrada para la compra',
  //           );

  //         const recep = await tx.requisicionRecepcion.create({
  //           data: {
  //             observaciones: dto.observaciones ?? null,
  //             usuario: { connect: { id: dto.usuarioId } },
  //             requisicion: { connect: { id: reqMain.id } },
  //             fechaRecepcion: dayjs().tz(TZGT).toDate(),
  //           },
  //         });
  //         requisicionRecepcionId = recep.id;
  //       }

  //       const nowISO = dayjs().tz(TZGT).toISOString();
  //       const stockDtos: Array<any> = [];
  //       const lineasRecep: Array<any> = [];

  //       let solicitadoTotal = 0;
  //       let recibidoEnEsta = 0;

  //       for (const det of compra.detalles) {
  //         const cantidadSolicitada = det.cantidad ?? 0;
  //         const cantidadRecibida = cantidadSolicitada;
  //         solicitadoTotal += cantidadSolicitada;
  //         recibidoEnEsta += cantidadRecibida;

  //         const precioUnitario = det.costoUnitario ?? 0;

  //         if (det.requisicionLineaId && requisicionRecepcionId) {
  //           const reqLinea = await tx.requisicionLinea.findUnique({
  //             where: { id: det.requisicionLineaId },
  //             select: { cantidadRecibida: true },
  //           });

  //           await tx.requisicionRecepcionLinea.create({
  //             data: {
  //               requisicionRecepcion: {
  //                 connect: { id: requisicionRecepcionId },
  //               },
  //               requisicionLinea: { connect: { id: det.requisicionLineaId } },
  //               producto: { connect: { id: det.productoId } },
  //               cantidadSolicitada,
  //               cantidadRecibida,
  //               ingresadaAStock: true,
  //             },
  //           });

  //           await tx.requisicionLinea.update({
  //             where: { id: det.requisicionLineaId },
  //             data: {
  //               cantidadRecibida:
  //                 (reqLinea?.cantidadRecibida ?? 0) + cantidadRecibida,
  //               ingresadaAStock: true,
  //             },
  //           });
  //         }

  //         stockDtos.push({
  //           productoId: det.productoId,
  //           cantidad: cantidadRecibida,
  //           costoTotal: precioUnitario * cantidadRecibida,
  //           fechaIngreso: nowISO,
  //           fechaExpiracion: null, // si manejas perecederos, aquí podrías calcular o dejar null
  //           precioCosto: precioUnitario,
  //           sucursalId,
  //           requisicionRecepcionId: requisicionRecepcionId ?? undefined,
  //         });

  //         lineasRecep.push({
  //           compraDetalleId: det.id,
  //           productoId: det.productoId,
  //           cantidadSolicitada,
  //           cantidadRecibida,
  //           precioUnitario,
  //         });
  //       }

  //       const entregaStockData = {
  //         fechaEntrega: dayjs().tz(TZGT).toDate(),
  //         montoTotal: stockDtos.reduce(
  //           (acc, s) => acc + (s.costoTotal ?? 0),
  //           0,
  //         ),
  //         proveedorId: proveedorIdEfectivo ?? null,
  //         sucursalId,
  //         recibidoPorId: dto.usuarioId,
  //       };

  //       await this.tracker.trackIngresoProductos(
  //         tx,
  //         lineasRecep.map((l) => ({
  //           productoId: l.productoId,
  //           cantidadRecibida: l.cantidadRecibida,
  //           precioUnitario: l.precioUnitario,
  //           requisicionLineaId: undefined, // ya lo registramos arriba si aplica
  //           cantidadSolicitada: l.cantidadSolicitada,
  //         })),
  //         sucursalId,
  //         dto.usuarioId,
  //         compra.requisicionId ?? null,
  //         'ENTREGA_STOCK',
  //         'Recepción TOTAL automática desde modúlo COMPRA',
  //       );

  //       const newStocks = await this.utilities.generateStockFromRequisicion(
  //         tx,
  //         stockDtos,
  //         entregaStockData,
  //       );

  //       if (compra.requisicionId) {
  //         const req = await tx.requisicion.findUnique({
  //           where: { id: compra.requisicionId },
  //           include: { lineas: true },
  //         });
  //         if (req) {
  //           const todasRecibidas = req.lineas.every(
  //             (ln) => (ln.cantidadRecibida ?? 0) >= ln.cantidadSugerida,
  //           );
  //           await tx.requisicion.update({
  //             where: { id: req.id },
  //             data: {
  //               fechaRecepcion: dayjs().tz(TZGT).toDate(),
  //               ingresadaAStock: true,
  //               estado: todasRecibidas ? 'COMPLETADA' : 'RECIBIDA',
  //             },
  //           });
  //         }
  //       }

  //       // 6) Marcar compra como recibida + flags opcionales
  //       const estadoCompra =
  //         recibidoEnEsta >= solicitadoTotal ? 'RECIBIDO' : 'RECIBIDO_PARCIAL';
  //       const ahora = dayjs().tz(TZGT).toDate();

  //       await tx.compra.update({
  //         where: { id: compra.id },
  //         data: {
  //           estado: estadoCompra,
  //           // si agregaste estos campos en Compra:
  //           ingresadaAStock: true,
  //           cantidadRecibidaAcumulada: compra.detalles.length,
  //         },
  //       });
  //       //registrar movimiento financiero

  //       const metodo = dto.metodoPago ?? 'EFECTIVO'; // o falla si no viene
  //       const canal = this.paymentChannel(metodo);

  //       let registroCajaId: number | undefined;
  //       if (canal === 'CAJA') {
  //         registroCajaId = dto.registroCajaId;
  //         if (!registroCajaId) {
  //           // intenta resolver automáticamente el turno abierto
  //           const turno = await tx.registroCaja.findFirst({
  //             where: { sucursalId, estado: 'ABIERTO' },
  //             select: { id: true },
  //           });
  //           if (!turno)
  //             throw new BadRequestException(
  //               'No hay turno de caja ABIERTO para registrar el pago en efectivo.',
  //             );
  //           registroCajaId = turno.id;
  //         }
  //         if (dto.cuentaBancariaId) {
  //           throw new BadRequestException(
  //             'No especifiques cuenta bancaria para pagos en efectivo.',
  //           );
  //         }
  //       }

  //       let cuentaBancariaId: number | undefined;
  //       if (canal === 'BANCO') {
  //         if (!dto.cuentaBancariaId) {
  //           throw new BadRequestException(
  //             'Debes seleccionar la cuenta bancaria para pagos por banco.',
  //           );
  //         }
  //         cuentaBancariaId = dto.cuentaBancariaId;
  //         if (dto.registroCajaId) {
  //           throw new BadRequestException(
  //             'No especifiques registro de caja para pagos por banco.',
  //           );
  //         }
  //       }

  //       const montoRecepcion = entregaStockData.montoTotal;
  //       const { deltaCaja, deltaBanco } = this.computeDeltas(
  //         metodo,
  //         montoRecepcion,
  //       );

  //       const mFinanciero = await tx.movimientoFinanciero.create({
  //         data: {
  //           fecha: dayjs().tz(TZGT).toDate(),
  //           sucursalId,
  //           clasificacion: 'COSTO_VENTA',
  //           motivo: 'COMPRA_MERCADERIA',
  //           metodoPago: metodo,
  //           deltaCaja,
  //           deltaBanco,
  //           afectaInventario: true,
  //           costoVentaTipo: 'MERCADERIA',
  //           referencia: `COMPRA#${compra.id}`,
  //           descripcion: `Compra #${compra.id} - recepción a stock`,
  //           cuentaBancariaId,
  //           registroCajaId,
  //           proveedorId: compra.proveedor?.id ?? null,
  //           usuarioId: dto.usuarioId,
  //           conFactura: (compra as any).conFactura ?? undefined,
  //         },
  //       });

  //       this.logger.log(
  //         'El movimiento generado por ingreso de productos es: ',
  //         mFinanciero,
  //       );

  //       return {
  //         ok: true,
  //         compra: { id: compra.id, estado: estadoCompra },
  //         recepcion: requisicionRecepcionId
  //           ? { id: requisicionRecepcionId }
  //           : null,
  //         lineas: lineasRecep,
  //         stock: newStocks,
  //       };
  //     });
  //   } catch (error) {
  //     if (error instanceof HttpException) throw error;
  //     throw new InternalServerErrorException('Fatal error: Error inesperado');
  //   }
  // }

  // EL ANTERIOR
  // async makeRecepcionCompraAuto(dto: RecepcionarCompraAutoDto) {
  //   try {
  //     this.logger.log('La data llegando es: ', dto);
  //     const { cuentaBancariaId } = dto;
  //     console.log('la cuenta es_:', cuentaBancariaId);

  //     return await this.prisma.$transaction(async (tx) => {
  //       const compra = await tx.compra.findUnique({
  //         where: { id: dto.compraId },
  //         include: {
  //           detalles: {
  //             select: {
  //               id: true,
  //               cantidad: true,
  //               costoUnitario: true,
  //               productoId: true,
  //               requisicionLineaId: true,
  //             },
  //           },
  //           proveedor: { select: { id: true } },
  //           pedido: {
  //             select: {
  //               id: true,
  //               estado: true,
  //               folio: true,
  //               tipo: true,
  //             },
  //           },
  //         },
  //       });
  //       if (!compra) throw new NotFoundException('Compra no encontrada');

  //       const sucursalId = compra.sucursalId;
  //       if (!sucursalId) {
  //         throw new BadRequestException(
  //           'La compra no tiene sucursal asociada.',
  //         );
  //       }
  //       // const proveedorIdEfectivo = compra.proveedorId ?? undefined;

  //       // 1) Si hay requisición, crear la recepción (igual que antes)
  //       let requisicionRecepcionId: number | null = null;
  //       if (compra.requisicionId) {
  //         const reqMain = await tx.requisicion.findUnique({
  //           where: { id: compra.requisicionId },
  //         });
  //         if (!reqMain)
  //           throw new NotFoundException(
  //             'Requisición origen no encontrada para la compra',
  //           );

  //         const recep = await tx.requisicionRecepcion.create({
  //           data: {
  //             observaciones: dto.observaciones ?? null,
  //             usuario: { connect: { id: dto.usuarioId } },
  //             requisicion: { connect: { id: reqMain.id } },
  //             fechaRecepcion: dayjs().tz(TZGT).toDate(),
  //           },
  //         });
  //         requisicionRecepcionId = recep.id;
  //       }

  //       // 2) Armar DTOs para stock y líneas de recepción (igual que antes)
  //       const nowISO = dayjs().tz(TZGT).toISOString();
  //       const stockDtos: Array<any> = [];
  //       const lineasRecep: Array<{
  //         compraDetalleId: number;
  //         productoId: number;
  //         cantidadSolicitada: number;
  //         cantidadRecibida: number;
  //         precioUnitario: number;
  //       }> = [];

  //       let solicitadoTotal = 0;
  //       let recibidoEnEsta = 0;

  //       for (const det of compra.detalles) {
  //         const cantidadSolicitada = det.cantidad ?? 0;
  //         const cantidadRecibida = cantidadSolicitada;
  //         solicitadoTotal += cantidadSolicitada;
  //         recibidoEnEsta += cantidadRecibida;

  //         const precioUnitario = det.costoUnitario ?? 0;

  //         // Actualizaciones de recepción/linea de requisición (igual que antes)
  //         if (det.requisicionLineaId && requisicionRecepcionId) {
  //           const reqLinea = await tx.requisicionLinea.findUnique({
  //             where: { id: det.requisicionLineaId },
  //             select: { cantidadRecibida: true },
  //           });

  //           await tx.requisicionRecepcionLinea.create({
  //             data: {
  //               requisicionRecepcion: {
  //                 connect: { id: requisicionRecepcionId },
  //               },
  //               requisicionLinea: { connect: { id: det.requisicionLineaId } },
  //               producto: { connect: { id: det.productoId } },
  //               cantidadSolicitada,
  //               cantidadRecibida,
  //               ingresadaAStock: true,
  //             },
  //           });

  //           await tx.requisicionLinea.update({
  //             where: { id: det.requisicionLineaId },
  //             data: {
  //               cantidadRecibida:
  //                 (reqLinea?.cantidadRecibida ?? 0) + cantidadRecibida,
  //               ingresadaAStock: true,
  //             },
  //           });
  //         }

  //         stockDtos.push({
  //           productoId: det.productoId,
  //           cantidad: cantidadRecibida,
  //           costoTotal: precioUnitario * cantidadRecibida,
  //           fechaIngreso: nowISO,
  //           fechaExpiracion: null,
  //           precioCosto: precioUnitario,
  //           sucursalId,
  //           requisicionRecepcionId: requisicionRecepcionId ?? undefined,
  //         });

  //         lineasRecep.push({
  //           compraDetalleId: det.id,
  //           productoId: det.productoId,
  //           cantidadSolicitada,
  //           cantidadRecibida,
  //           precioUnitario,
  //         });
  //       }

  //       // 3) Calcular cantidades anteriores por producto (antes de insertar stock)
  //       const productIds = Array.from(
  //         new Set(lineasRecep.map((l) => l.productoId)),
  //       );
  //       const cantidadesAnteriores: Record<number, number> = {};
  //       await Promise.all(
  //         productIds.map(async (pid) => {
  //           const agg = await tx.stock.aggregate({
  //             where: { productoId: pid, sucursalId },
  //             _sum: { cantidad: true },
  //           });
  //           cantidadesAnteriores[pid] = agg._sum.cantidad ?? 0;
  //         }),
  //       );

  //       // 4) Datos de entrega que usará el util
  //       const entregaStockData = {
  //         fechaEntrega: dayjs().tz(TZGT).toDate(),
  //         montoTotal: stockDtos.reduce(
  //           (acc, s) => acc + (s.costoTotal ?? 0),
  //           0,
  //         ),
  //         proveedorId: dto.proveedorId ?? null,
  //         sucursalId,
  //         recibidoPorId: dto.usuarioId,
  //       };

  //       // 5) Generar stock desde requisición (igual que antes) — crea la entrega internamente
  //       const newStocks = await this.utilities.generateStockFromRequisicion(
  //         tx,
  //         stockDtos,
  //         entregaStockData,
  //       );

  //       // 6) Resolver entregaId para tracking (no cambiamos el util; resolvemos robusto)
  //       let entregaId: number | null = null;

  //       // a) Si tu util devuelve un objeto con entrega (ideal)
  //       if (
  //         newStocks &&
  //         typeof newStocks === 'object' &&
  //         'entrega' in newStocks
  //       ) {
  //         const maybeEntrega = (newStocks as any).entrega;
  //         if (maybeEntrega?.id) entregaId = maybeEntrega.id;
  //       }

  //       // b) Si tu util devuelve arreglo de stocks con entregaStockId
  //       if (!entregaId && Array.isArray(newStocks) && newStocks.length > 0) {
  //         const first = newStocks[0] as any;
  //         if (first?.entregaStockId) entregaId = first.entregaStockId;
  //       }

  //       // c) Fallback: buscar la última entrega del usuario en la sucursal dentro de la tx
  //       if (!entregaId) {
  //         const entregaGuess = await tx.entregaStock.findFirst({
  //           where: { sucursalId, recibidoPorId: dto.usuarioId },
  //           orderBy: { id: 'desc' },
  //           select: { id: true },
  //         });
  //         entregaId = entregaGuess?.id ?? null;
  //       }

  //       // 7) Tracking correcto enlazado a la entrega
  //       if (entregaId) {
  //         const trackers = lineasRecep.map((l) => ({
  //           productoId: l.productoId,
  //           cantidadVendida: l.cantidadRecibida, // recibido = “vendida” en tu tracker
  //           cantidadAnterior: cantidadesAnteriores[l.productoId] ?? 0,
  //         }));
  //         await this.tracker.trackeEntregaStock(
  //           tx,
  //           trackers,
  //           sucursalId,
  //           dto.usuarioId,
  //           entregaId,
  //           'ENTREGA_STOCK',
  //           `Recepción TOTAL automática desde módulo COMPRA (origen: ${compra.origen})`,
  //         );
  //       } else {
  //         this.logger.warn(
  //           '[makeRecepcionCompraAuto] No se pudo resolver entregaId para tracking.',
  //         );
  //       }

  //       // 8) Actualizaciones de requisición (igual que antes)
  //       if (compra.requisicionId) {
  //         const req = await tx.requisicion.findUnique({
  //           where: { id: compra.requisicionId },
  //           include: { lineas: true },
  //         });
  //         if (req) {
  //           const todasRecibidas = req.lineas.every(
  //             (ln) => (ln.cantidadRecibida ?? 0) >= ln.cantidadSugerida,
  //           );
  //           await tx.requisicion.update({
  //             where: { id: req.id },
  //             data: {
  //               fechaRecepcion: dayjs().tz(TZGT).toDate(),
  //               ingresadaAStock: true,
  //               estado: todasRecibidas ? 'COMPLETADA' : 'RECIBIDA',
  //             },
  //           });
  //         }
  //       }

  //       // 👇 NUEVO: si provino de PEDIDO, lo marcamos como RECIBIDO
  //       if (compra.pedido?.id) {
  //         await tx.pedido.update({
  //           where: { id: compra.pedido.id },
  //           data: { estado: 'RECIBIDO' },
  //         });
  //       }

  //       // 9) Estado de compra (igual que antes)
  //       const estadoCompra =
  //         recibidoEnEsta >= solicitadoTotal ? 'RECIBIDO' : 'RECIBIDO_PARCIAL';

  //       await tx.compra.update({
  //         where: { id: compra.id },
  //         data: {
  //           estado: estadoCompra,
  //           ingresadaAStock: true,
  //           // cantidadRecibidaAcumulada: compra.detalles.length,
  //           cantidadRecibidaAcumulada:
  //             (compra.cantidadRecibidaAcumulada ?? 0) + recibidoEnEsta,
  //         },
  //       });

  //       // 10) Movimiento financiero (igual que antes)
  //       const metodo = dto.metodoPago ?? 'EFECTIVO';
  //       const canal = this.paymentChannel(metodo);

  //       let registroCajaId: number | undefined;
  //       if (canal === 'CAJA') {
  //         registroCajaId = dto.registroCajaId;
  //         if (!registroCajaId) {
  //           const turno = await tx.registroCaja.findFirst({
  //             where: { sucursalId, estado: 'ABIERTO' },
  //             select: { id: true },
  //           });
  //           if (!turno)
  //             throw new BadRequestException(
  //               'No hay turno de caja ABIERTO para registrar el pago en efectivo.',
  //             );
  //           registroCajaId = turno.id;
  //         }
  //         if (dto.cuentaBancariaId) {
  //           throw new BadRequestException(
  //             'No especifiques cuenta bancaria para pagos en efectivo.',
  //           );
  //         }
  //       }

  //       let cuentaBancariaId: number | undefined;
  //       if (canal === 'BANCO') {
  //         if (!dto.cuentaBancariaId) {
  //           throw new BadRequestException(
  //             'Debes seleccionar la cuenta bancaria para pagos por banco.',
  //           );
  //         }
  //         cuentaBancariaId = dto.cuentaBancariaId;
  //         if (dto.registroCajaId) {
  //           throw new BadRequestException(
  //             'No especifiques registro de caja para pagos por banco.',
  //           );
  //         }
  //       }

  //       const montoRecepcion = entregaStockData.montoTotal;
  //       const { deltaCaja, deltaBanco } = this.computeDeltas(
  //         metodo,
  //         montoRecepcion,
  //       );

  //       const mFinanciero = await tx.movimientoFinanciero.create({
  //         data: {
  //           fecha: dayjs().tz(TZGT).toDate(),
  //           sucursalId,
  //           clasificacion: 'COSTO_VENTA',
  //           motivo: 'COMPRA_MERCADERIA',
  //           metodoPago: metodo,
  //           deltaCaja,
  //           deltaBanco,
  //           afectaInventario: true,
  //           costoVentaTipo: 'MERCADERIA',
  //           referencia: `COMPRA#${compra.id}`,
  //           descripcion: `Compra #${compra.id} - recepción a stock`,
  //           cuentaBancariaId,
  //           registroCajaId,
  //           proveedorId: compra.proveedor?.id ?? null,
  //           usuarioId: dto.usuarioId,
  //           conFactura: (compra as any).conFactura ?? undefined,
  //         },
  //       });

  //       this.logger.log(
  //         'El movimiento generado por ingreso de productos es: ',
  //         mFinanciero,
  //       );

  //       // 11) Respuesta (misma forma que ya tenías)
  //       return {
  //         ok: true,
  //         compra: { id: compra.id, estado: estadoCompra },
  //         recepcion: requisicionRecepcionId
  //           ? { id: requisicionRecepcionId }
  //           : null,
  //         lineas: lineasRecep,
  //         stock: newStocks,
  //       };
  //     });
  //   } catch (error) {
  //     this.logger.error('El error generado es: ', error);
  //     if (error instanceof HttpException) throw error;
  //     throw new InternalServerErrorException('Fatal error: Error inesperado');
  //   }
  // }

  async makeRecepcionCompraAuto(dto: RecepcionarCompraAutoDto) {
    try {
      this.logger.log('La data llegando es: ', dto);
      const { cuentaBancariaId } = dto;
      console.log('la cuenta es_:', cuentaBancariaId);

      return await this.prisma.$transaction(async (tx) => {
        // 0) Cargar compra con PRESENTACIONES en detalles
        const compra = await tx.compra.findUnique({
          where: { id: dto.compraId },
          include: {
            detalles: {
              select: {
                id: true,
                cantidad: true, // cantidad en la UNIDAD de la línea (presentación o unidad)
                costoUnitario: true, // costo por esa unidad (presentación o unidad)
                productoId: true,
                requisicionLineaId: true,
                // 👇 NUEVO: traemos presentacion (si existe) para convertir a base
                presentacionId: true,
                presentacion: {
                  select: {
                    id: true,
                    factorUnidadBase: true, // Decimal(18,6)
                    nombre: true,
                    sku: true,
                  },
                },
              },
            },
            proveedor: { select: { id: true } },
            pedido: {
              select: {
                id: true,
                estado: true,
                folio: true,
                tipo: true,
              },
            },
            // necesitamos sucursalId para stock
            // (ya lo usabas antes)
          },
        });
        if (!compra) throw new NotFoundException('Compra no encontrada');

        const sucursalId = compra.sucursalId;
        if (!sucursalId) {
          throw new BadRequestException(
            'La compra no tiene sucursal asociada.',
          );
        }

        // 1) Si hay requisición, crear la recepción (igual que antes)
        let requisicionRecepcionId: number | null = null;
        if (compra.requisicionId) {
          const reqMain = await tx.requisicion.findUnique({
            where: { id: compra.requisicionId },
          });
          if (!reqMain)
            throw new NotFoundException(
              'Requisición origen no encontrada para la compra',
            );

          const recep = await tx.requisicionRecepcion.create({
            data: {
              observaciones: dto.observaciones ?? null,
              usuario: { connect: { id: dto.usuarioId } },
              requisicion: { connect: { id: reqMain.id } },
              fechaRecepcion: dayjs().tz(TZGT).toDate(),
            },
          });
          requisicionRecepcionId = recep.id;
        }

        // 2) Armar DTOs para stock (BASE) y líneas de recepción (igual que antes)
        const nowISO = dayjs().tz(TZGT).toISOString();

        type LineaRecep = {
          compraDetalleId: number;
          productoId: number;
          cantidadSolicitada: number; // en unidad declarada por la línea (presentación o unidad)
          cantidadRecibida: number; // idem arriba
          precioUnitario: number; // costo por esa unidad (presentación o unidad)
          // 👇 NUEVO: cantidad en base (para tracking/stock)
          cantidadRecibidaBase: number; // unidades base (int)
        };

        const stockDtos: Array<any> = []; // para helper generateStockFromRequisicion (en unidades BASE)
        const stockPresentacionDtos: Array<{
          productoId: number;
          presentacionId: number;
          sucursalId: number;
          cantidadPresentacion: number;
          costoUnitarioBase: number; // costo por unidad BASE (Decimal(12,4) en schema)
          costoUnitarioPresentacion: number; // costo por PRESENTACIÓN (Decimal(12,4) en schema)
          fechaIngreso: Date;
          fechaVencimiento?: Date | null;
        }> = [];

        const lineasRecep: Array<LineaRecep> = [];

        let solicitadoTotal = 0;
        let recibidoEnEsta = 0;

        // para tracking en base
        const productBaseAcumulado: Record<number, number> = {};

        for (const det of compra.detalles) {
          const cantLinea = det.cantidad ?? 0; // cantidad de la línea (puede ser presentaciones)
          const precioUnitLinea = det.costoUnitario ?? 0; // costo por esa unidad (presentación/unidad)
          solicitadoTotal += cantLinea;
          recibidoEnEsta += cantLinea;

          // 👇 NUEVO: convertir a BASE si hay presentacion
          const factor = det.presentacion?.factorUnidadBase
            ? Number(det.presentacion.factorUnidadBase)
            : 1;

          // redondeamos a int por schema de Stock.cantidad (Int)
          const cantidadBase = Math.round(cantLinea * factor);

          // costo base = costo presentacion / factor (si factor>0)
          const costoUnitarioBase =
            factor > 0 ? precioUnitLinea / factor : precioUnitLinea;

          // === a) Requisición (líneas + acumulados) ===
          if (det.requisicionLineaId && requisicionRecepcionId) {
            const reqLinea = await tx.requisicionLinea.findUnique({
              where: { id: det.requisicionLineaId },
              select: { cantidadRecibida: true },
            });

            await tx.requisicionRecepcionLinea.create({
              data: {
                requisicionRecepcion: {
                  connect: { id: requisicionRecepcionId },
                },
                requisicionLinea: { connect: { id: det.requisicionLineaId } },
                producto: { connect: { id: det.productoId } },
                cantidadSolicitada: cantLinea, // se mantiene en “unidad” original de la línea
                cantidadRecibida: cantLinea, // idem
                ingresadaAStock: true,
                // (si quisieras guardar presentacionId aquí en el futuro, habría que extender el schema)
              },
            });

            await tx.requisicionLinea.update({
              where: { id: det.requisicionLineaId },
              data: {
                cantidadRecibida: (reqLinea?.cantidadRecibida ?? 0) + cantLinea,
                ingresadaAStock: true,
              },
            });
          }

          // === b) Stock BASE (compatibilidad con todo lo existente) ===
          stockDtos.push({
            productoId: det.productoId,
            cantidad: cantidadBase, // BASE
            costoTotal: costoUnitarioBase * cantidadBase, // = precioUnitLinea*cantLinea
            fechaIngreso: nowISO,
            fechaExpiracion: null,
            precioCosto: costoUnitarioBase, // BASE
            sucursalId,
            requisicionRecepcionId: requisicionRecepcionId ?? undefined,
          });

          // === c) Stock de PRESENTACIÓN (si aplica) ===
          if (det.presentacionId) {
            stockPresentacionDtos.push({
              productoId: det.productoId,
              presentacionId: det.presentacionId,
              sucursalId,
              cantidadPresentacion: cantLinea, // número de presentaciones recibidas
              costoUnitarioBase: costoUnitarioBase, // BASE (Decimal en DB)
              costoUnitarioPresentacion: precioUnitLinea, // PRESENTACIÓN
              fechaIngreso: dayjs().tz(TZGT).toDate(),
              fechaVencimiento: null,
            });
          }

          // === d) array UI/tracking ===
          lineasRecep.push({
            compraDetalleId: det.id,
            productoId: det.productoId,
            cantidadSolicitada: cantLinea,
            cantidadRecibida: cantLinea,
            precioUnitario: precioUnitLinea,
            cantidadRecibidaBase: cantidadBase,
          });

          productBaseAcumulado[det.productoId] =
            (productBaseAcumulado[det.productoId] ?? 0) + cantidadBase;
        }

        // 3) Calcular cantidades anteriores por producto (antes de insertar stock BASE)
        const productIds = Object.keys(productBaseAcumulado).map((s) =>
          Number(s),
        );
        const cantidadesAnteriores: Record<number, number> = {};
        await Promise.all(
          productIds.map(async (pid) => {
            const agg = await tx.stock.aggregate({
              where: { productoId: pid, sucursalId },
              _sum: { cantidad: true },
            });
            cantidadesAnteriores[pid] = agg._sum.cantidad ?? 0;
          }),
        );

        // 4) Datos de entrega (monto en PRESENTACIÓN; es equivalente)
        const entregaStockData = {
          fechaEntrega: dayjs().tz(TZGT).toDate(),
          montoTotal: stockDtos.reduce(
            (acc, s) => acc + (s.costoTotal ?? 0),
            0,
          ),
          proveedorId: dto.proveedorId ?? null,
          sucursalId,
          recibidoPorId: dto.usuarioId,
        };

        // 5) Generar STOCK BASE (helper existente, NO se toca)
        const result = await this.utilities.generateStockFromRequisicion(
          tx,
          stockDtos,
          entregaStockData,
        );

        const newStocks =
          (result as any)?.newStocksCreated ??
          (Array.isArray(result) ? result : []);
        let entregaId: number | null =
          (result as any)?.entregaStock?.id ??
          newStocks?.[0]?.entregaStockId ??
          null;

        if (!entregaId) {
          const entregaGuess = await tx.entregaStock.findFirst({
            where: { sucursalId, recibidoPorId: dto.usuarioId },
            orderBy: { id: 'desc' },
            select: { id: true },
          });
          entregaId = entregaGuess?.id ?? null;
        }

        // 6) **Crear STOCK de PRESENTACIÓN** (nuevo pero sin romper nada)
        if (stockPresentacionDtos.length > 0) {
          await Promise.all(
            stockPresentacionDtos.map((sp) =>
              tx.stockPresentacion.create({
                data: {
                  producto: { connect: { id: sp.productoId } },
                  presentacion: { connect: { id: sp.presentacionId } },
                  sucursal: { connect: { id: sp.sucursalId } },
                  cantidadPresentacion: sp.cantidadPresentacion, // Int
                  costoUnitarioBase: sp.costoUnitarioBase, // Decimal(12,4)
                  costoUnitarioPresentacion: sp.costoUnitarioPresentacion, // Decimal(12,4)
                  fechaIngreso: sp.fechaIngreso,
                  fechaVencimiento: sp.fechaVencimiento ?? null,
                  cantidadRecibidaInicial: sp.cantidadPresentacion,
                },
              }),
            ),
          );
        }

        // 7) Tracking enlazado a la ENTREGA (en UNIDADES BASE coherentes con Stock)
        if (entregaId) {
          const trackers = productIds.map((pid) => ({
            productoId: pid,
            cantidadVendida: productBaseAcumulado[pid], // BASE
            cantidadAnterior: cantidadesAnteriores[pid] ?? 0,
          }));
          await this.tracker.trackeEntregaStock(
            tx,
            trackers,
            sucursalId,
            dto.usuarioId,
            entregaId,
            'ENTREGA_STOCK',
            `Recepción TOTAL automática desde módulo COMPRA (origen: ${compra.origen})`,
          );
        } else {
          this.logger.warn(
            '[makeRecepcionCompraAuto] No se pudo resolver entregaId para tracking.',
          );
        }

        // 8) Actualizaciones de requisición (igual que antes)
        if (compra.requisicionId) {
          const req = await tx.requisicion.findUnique({
            where: { id: compra.requisicionId },
            include: { lineas: true },
          });
          if (req) {
            const todasRecibidas = req.lineas.every(
              (ln) => (ln.cantidadRecibida ?? 0) >= ln.cantidadSugerida,
            );
            await tx.requisicion.update({
              where: { id: req.id },
              data: {
                fechaRecepcion: dayjs().tz(TZGT).toDate(),
                ingresadaAStock: true,
                estado: todasRecibidas ? 'COMPLETADA' : 'RECIBIDA',
              },
            });
          }
        }

        // 9) Si provino de PEDIDO, marcar como RECIBIDO
        if (compra.pedido?.id) {
          await tx.pedido.update({
            where: { id: compra.pedido.id },
            data: { estado: 'RECIBIDO' },
          });
        }

        // 10) Estado de compra (igual que antes, a nivel “unidad de línea”)
        const estadoCompra =
          recibidoEnEsta >= solicitadoTotal ? 'RECIBIDO' : 'RECIBIDO_PARCIAL';

        await tx.compra.update({
          where: { id: compra.id },
          data: {
            estado: estadoCompra,
            ingresadaAStock: true,
            cantidadRecibidaAcumulada:
              (compra.cantidadRecibidaAcumulada ?? 0) + recibidoEnEsta,
          },
        });

        // 11) Movimiento financiero (igual que antes)
        const metodo = dto.metodoPago ?? 'EFECTIVO';
        const canal = this.paymentChannel(metodo);

        let registroCajaId: number | undefined;
        if (canal === 'CAJA') {
          registroCajaId = dto.registroCajaId;
          if (!registroCajaId) {
            const turno = await tx.registroCaja.findFirst({
              where: { sucursalId, estado: 'ABIERTO' },
              select: { id: true },
            });
            if (!turno)
              throw new BadRequestException(
                'No hay turno de caja ABIERTO para registrar el pago en efectivo.',
              );
            registroCajaId = turno.id;
          }
          if (dto.cuentaBancariaId) {
            throw new BadRequestException(
              'No especifiques cuenta bancaria para pagos en efectivo.',
            );
          }
        }

        let cuentaBancariaIdLocal: number | undefined;
        if (canal === 'BANCO') {
          if (!dto.cuentaBancariaId) {
            throw new BadRequestException(
              'Debes seleccionar la cuenta bancaria para pagos por banco.',
            );
          }
          cuentaBancariaIdLocal = dto.cuentaBancariaId;
          if (dto.registroCajaId) {
            throw new BadRequestException(
              'No especifiques registro de caja para pagos por banco.',
            );
          }
        }

        const montoRecepcion = entregaStockData.montoTotal;
        const { deltaCaja, deltaBanco } = this.computeDeltas(
          metodo,
          montoRecepcion,
        );

        const mFinanciero = await tx.movimientoFinanciero.create({
          data: {
            fecha: dayjs().tz(TZGT).toDate(),
            sucursalId,
            clasificacion: 'COSTO_VENTA',
            motivo: 'COMPRA_MERCADERIA',
            metodoPago: metodo,
            deltaCaja,
            deltaBanco,
            afectaInventario: true,
            costoVentaTipo: 'MERCADERIA',
            referencia: `COMPRA#${compra.id}`,
            descripcion: `Compra #${compra.id} - recepción a stock`,
            cuentaBancariaId: cuentaBancariaIdLocal,
            registroCajaId,
            proveedorId: compra.proveedor?.id ?? null,
            usuarioId: dto.usuarioId,
            conFactura: (compra as any).conFactura ?? undefined,
          },
        });

        this.logger.log(
          'El movimiento generado por ingreso de productos es: ',
          mFinanciero,
        );

        // 12) Respuesta
        return {
          ok: true,
          compra: { id: compra.id, estado: estadoCompra },
          recepcion: requisicionRecepcionId
            ? { id: requisicionRecepcionId }
            : null,
          lineas: lineasRecep,
          stockBase: newStocks,
          // 👇 opcional: podrías exponer cuántos StockPresentacion se crearon
          stockPresentacionCount: stockPresentacionDtos.length,
        };
      });
    } catch (error) {
      this.logger.error('El error generado es: ', error);
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Fatal error: Error inesperado');
    }
  }

  // helpers
  paymentChannel(
    m: MetodoPago | null | undefined,
  ): 'CAJA' | 'BANCO' | 'NINGUNO' {
    switch (m) {
      case 'EFECTIVO':
      case 'CONTADO':
        return 'CAJA';
      case 'TRANSFERENCIA':
      case 'TARJETA':
      case 'CHEQUE':
        return 'BANCO';
      case 'CREDITO':
      default:
        return 'NINGUNO';
    }
  }

  computeDeltas(m: MetodoPago | null | undefined, monto: number) {
    const x = Math.abs(Number(monto) || 0);
    switch (m) {
      case 'EFECTIVO':
      case 'CONTADO':
        return { deltaCaja: -x, deltaBanco: 0 };
      case 'TRANSFERENCIA':
      case 'TARJETA':
      case 'CHEQUE':
        return { deltaCaja: 0, deltaBanco: -x };
      case 'CREDITO':
      default:
        return { deltaCaja: 0, deltaBanco: 0 };
    }
  }

  findAll() {
    return `This action returns all purchaseRequisitions`;
  }

  findOne(id: number) {
    return `This action returns a #${id} purchaseRequisition`;
  }

  update(
    id: number,
    updatePurchaseRequisitionDto: UpdatePurchaseRequisitionDto,
  ) {
    return `This action updates a #${id} purchaseRequisition`;
  }

  remove(id: number) {
    return `This action removes a #${id} purchaseRequisition`;
  }

  /**
   * Crea una Compra (origen: REQUISICION) a partir de la requisición dada.
   * - Mantiene tu patrón: cabecera con total=0 -> detalles en loop -> recálculo total -> update.
   * - Ahora soporta presentaciones: si la RequisicionLinea trae presentacionId, el detalle la conecta.
   */
  async createCompraFromRequisiciones(
    createPurchaseRequisitionDto: CreatePurchaseRequisitionDto,
    opts?: { proveedorId?: number; sucursalId?: number }, // sigue opcional por compatibilidad; usamos DTO.proveedorId como fuente principal
  ) {
    try {
      this.logger.log('La data del envio es: ', createPurchaseRequisitionDto);
      const { requisicionID, userID, proveedorId } =
        createPurchaseRequisitionDto;

      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.compra.findFirst({
          where: { requisicionId: requisicionID },
          include: { detalles: true },
        });
        if (existing) {
          throw new BadRequestException('La requisición ya tiene una compra');
        }

        const req = await tx.requisicion.findUniqueOrThrow({
          where: { id: requisicionID },
          include: {
            sucursal: { select: { id: true } },
            lineas: {
              include: {
                producto: { select: { id: true, precioCostoActual: true } },
                presentacion: {
                  select: {
                    id: true,
                    productoId: true,
                    costoReferencialPresentacion: true,
                  },
                },
              },
            },
          },
        });

        if (!req.lineas.length) {
          throw new BadRequestException('La requisición no tiene líneas');
        }

        const detallesData = req.lineas.map((ln) => {
          const costoUnitario =
            ln.precioUnitario ??
            ln.presentacion?.costoReferencialPresentacion ??
            ln.producto.precioCostoActual ??
            0;

          // sanity: si viene presentacion, debe pertenecer al mismo producto
          if (
            ln.presentacion &&
            ln.presentacion.productoId !== ln.producto.id
          ) {
            throw new BadRequestException(
              `Inconsistencia: la presentación ${ln.presentacion.id} no pertenece al producto ${ln.producto.id} (línea ${ln.id}).`,
            );
          }

          return {
            cantidad: ln.cantidadSugerida,
            costoUnitario,
            productoId: ln.producto.id,
            presentacionId: ln.presentacion?.id ?? null,
            requisicionLineaId: ln.id,
          };
        });

        const compra = await tx.compra.create({
          data: {
            fecha: dayjs().tz(TZGT).toDate(),
            total: 0,
            usuario: { connect: { id: userID } },
            sucursal: { connect: { id: opts?.sucursalId ?? req.sucursal.id } },
            requisicion: { connect: { id: req.id } },
            estado: 'ESPERANDO_ENTREGA',
            origen: 'REQUISICION',
          },
        });

        for (const d of detallesData) {
          await tx.compraDetalle.create({
            data: {
              cantidad: d.cantidad,
              costoUnitario: Number(d.costoUnitario),
              producto: { connect: { id: d.productoId } },
              ...(d.presentacionId
                ? { presentacion: { connect: { id: d.presentacionId } } }
                : {}),
              compra: { connect: { id: compra.id } },
              requisicionLinea: { connect: { id: d.requisicionLineaId } },
            },
          });
        }

        // 6) Recalcular total (puedes calcular a partir de detallesData y ahorrarte esta query si quieres)
        const detalles = await tx.compraDetalle.findMany({
          where: { compraId: compra.id },
          select: { cantidad: true, costoUnitario: true },
        });
        const total = detalles.reduce(
          (acc, it) => acc + it.cantidad * it.costoUnitario,
          0,
        );

        // 7) Actualizar compra con total y proveedor
        await tx.compra.update({
          where: { id: compra.id },
          data: {
            total,
            proveedor: proveedorId
              ? { connect: { id: proveedorId } }
              : undefined,
          },
        });

        // 8) Marcar requisición como enviada a compras
        await tx.requisicion.update({
          where: { id: req.id },
          data: { estado: 'ENVIADA_COMPRAS' },
        });

        // 9) Respuesta enriquecida
        return tx.compra.findUnique({
          where: { id: compra.id },
          include: {
            detalles: {
              include: {
                producto: true,
                presentacion: true,
                requisicionLinea: true,
              },
            },
            proveedor: true,
            sucursal: true,
          },
        });
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('No fue posible crear la compra');
    }
  }
}
