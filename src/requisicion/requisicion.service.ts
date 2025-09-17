import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateRequisicionDto } from './dto/create-requisicion.dto';
import { UpdateRequisicionDto } from './dto/update-requisicion.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CreateRequisitionDto,
  RequisitionResponse,
  StockAlertItem,
} from './utils';
import { UpdateRequisitionDto } from './dto/update-requisiciones.dto';

import * as dayjs from 'dayjs';
import 'dayjs/locale/es';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';
import * as isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import * as isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import { Prisma, TipoEmpaque } from '@prisma/client';
import { RequisitionProductCandidate } from './interfaces/requisicionProductCandidate';
import { GetV2Args, PagedResponse } from './interfaces/newInterfacesPaginacion';
import { RequisicionLineasDTO } from './interfaces/requiscionWithPresentaciones';
import { TZGT } from 'src/utils/utils';
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.locale('es');

@Injectable()
export class RequisicionService {
  private readonly logger = new Logger(RequisicionService.name);
  constructor(private readonly prisma: PrismaService) {}

  private async actualizarPrecioPresentacion(
    tx: Prisma.TransactionClient,
    precioNuevo: number | null | undefined,
    presentacionID: number | null | undefined,
    actualizarCosto: boolean | null | undefined,
  ) {
    if (!actualizarCosto || !presentacionID || !precioNuevo || precioNuevo <= 0)
      return;

    await tx.productoPresentacion.update({
      where: { id: presentacionID },
      data: { costoReferencialPresentacion: precioNuevo },
    });

    this.logger.log(
      `Presentación ${presentacionID} costo actualizado a: ${precioNuevo}`,
    );
  }

  /** Actualiza costo de un producto si trae flag y precio válido (>0) */
  private async actualizarPrecioProducto(
    tx: Prisma.TransactionClient,
    precioNuevo: number | null | undefined,
    productoID: number | null | undefined,
    actualizarCosto: boolean | null | undefined,
  ) {
    if (!actualizarCosto || !productoID || !precioNuevo || precioNuevo <= 0)
      return;

    await tx.producto.update({
      where: { id: productoID },
      data: { precioCostoActual: precioNuevo },
    });

    this.logger.log(
      `Producto ${productoID} costo actualizado a: ${precioNuevo}`,
    );
  }

  async getStockAlerts(sucursalId: number): Promise<StockAlertItem[]> {
    // 1) Trae thresholds + producto
    const thresholds = await this.prisma.stockThreshold.findMany({
      include: {
        producto: {
          select: {
            id: true,
            nombre: true,
            codigoProducto: true,
            precioCostoActual: true,
          },
        },
      },
    });

    const productoIds = thresholds.map((t) => t.productoId);

    // 2) Busca todas las líneas de requisición “pendientes” para esos productos
    const pendientes = await this.prisma.requisicionLinea.findMany({
      where: {
        productoId: { in: productoIds },
        ingresadaAStock: false, // aún no entra al stock
        requisicion: { estado: 'PENDIENTE' },
      },
      select: {
        productoId: true,
        requisicion: { select: { folio: true } },
      },
    });

    // 3) Agrupa los folios por productoId
    const mapaPendientes = pendientes.reduce((m, linea) => {
      const arr = m.get(linea.productoId) ?? [];
      arr.push(linea.requisicion.folio);
      m.set(linea.productoId, arr);
      return m;
    }, new Map<number, string[]>());

    const alerts: StockAlertItem[] = [];

    // 4) Itera thresholds y arma el StockAlertItem
    for (const t of thresholds) {
      // calcula stockActual
      const { _sum } = await this.prisma.stock.aggregate({
        where: { productoId: t.productoId, sucursalId },
        _sum: { cantidad: true },
      });
      const stockActual = _sum.cantidad ?? 0;

      if (stockActual <= t.stockMinimo) {
        const faltante = Math.max(t.stockMinimo - stockActual, 1);

        const folios = mapaPendientes.get(t.productoId) ?? [];

        alerts.push({
          productoId: t.productoId,
          nombre: t.producto.nombre,
          codigoProducto: t.producto.codigoProducto,
          id: t.producto.id,
          stockActual,
          stockMinimo: t.stockMinimo,
          cantidadSugerida: faltante,
          precioCosto: t.producto.precioCostoActual ?? 0,
          // nuevos campos:
          tieneSolicitudPendiente: folios.length > 0,
          foliosPendientes: folios,
        });
      }
    }

    return alerts;
  }

  /**
   * Candidatos para requisición (v2):
   * - Trae TODOS los productos (tengan o no StockThreshold)
   * - Incluye presentaciones, costos referenciales y tipo de empaque
   * - Calcula stock total EQUIVALENTE en unidades base (producto + presentaciones)
   * - Marca pendientes (producto/presentación)
   * - Ordena para priorizar críticos (bajo umbral y mayor faltante)
   */

  /**
   * v2 con paginación, búsqueda y orden
   */
  async getRequisitionProductsV2(
    args: GetV2Args,
  ): Promise<PagedResponse<RequisitionProductCandidate>> {
    const {
      sucursalId,
      page = 1,
      pageSize = 10,
      q = '',
      sortBy = 'priority',
      sortDir = 'asc',
    } = args;

    // ===== 1) WHERE de búsqueda =====
    const whereProducto: Prisma.ProductoWhereInput = q
      ? {
          OR: [
            { nombre: { contains: q, mode: 'insensitive' } },
            { codigoProducto: { contains: q, mode: 'insensitive' } },
            {
              presentaciones: {
                some: {
                  OR: [
                    { nombre: { contains: q, mode: 'insensitive' } },
                    { sku: { contains: q, mode: 'insensitive' } },
                    { codigoBarras: { contains: q, mode: 'insensitive' } },
                  ],
                },
              },
            },
          ],
        }
      : {};

    this.logger.log('el where dinamico es: ', whereProducto);

    // ===== 2) Traer productos filtrados (ids) y total =====
    const [productos, total] = await this.prisma.$transaction([
      this.prisma.producto.findMany({
        where: whereProducto,
        select: {
          id: true,
          nombre: true,
          codigoProducto: true,
          unidadBase: true,
          precioCostoActual: true,
          stockThreshold: { select: { stockMinimo: true } },
          presentaciones: {
            select: {
              id: true,
              nombre: true,
              factorUnidadBase: true,
              sku: true,
              codigoBarras: true,
              esDefault: true,
              activo: true,
              tipoPresentacion: true,
              costoReferencialPresentacion: true,
            },
          },
        },
      }),
      this.prisma.producto.count({ where: whereProducto }),
    ]);

    if (productos.length === 0) {
      return { items: [], page, pageSize, total: 0, totalPages: 0 };
    }

    const productoIds = productos.map((p) => p.id);
    const presentacionIds = productos.flatMap((p) =>
      p.presentaciones.map((pp) => pp.id),
    );

    // ===== 3) Agregados por sucursal (callback) =====
    const { stockBaseGroup, stockPresGroup, pendientes } =
      await this.prisma.$transaction(async (tx) => {
        const stockBaseGroup = await tx.stock.groupBy({
          by: ['productoId'],
          where: { sucursalId, productoId: { in: productoIds } },
          _sum: { cantidad: true },
        });

        const stockPresGroup = presentacionIds.length
          ? await tx.stockPresentacion.groupBy({
              by: ['presentacionId'],
              where: { sucursalId, presentacionId: { in: presentacionIds } },
              _sum: { cantidadPresentacion: true },
            })
          : ([] as Array<{
              presentacionId: number;
              _sum: { cantidadPresentacion: number | null };
            }>);

        const pendientes = await tx.requisicionLinea.findMany({
          where: {
            ingresadaAStock: false,
            requisicion: { estado: 'PENDIENTE' },
            OR: [
              { productoId: { in: productoIds } },
              ...(presentacionIds.length
                ? [{ presentacionId: { in: presentacionIds } }]
                : []),
            ],
          },
          select: {
            productoId: true,
            presentacionId: true,
            requisicion: { select: { folio: true } },
          },
        });

        return { stockBaseGroup, stockPresGroup, pendientes };
      });

    const stockBaseMap = new Map<number, number>();
    stockBaseGroup.forEach((g) =>
      stockBaseMap.set(g.productoId, g._sum.cantidad ?? 0),
    );

    const stockPresMap = new Map<number, number>();
    stockPresGroup.forEach((g) =>
      stockPresMap.set(g.presentacionId, g._sum.cantidadPresentacion ?? 0),
    );

    const pendProdMap = new Map<number, string[]>();
    const pendPresMap = new Map<number, string[]>();
    for (const l of pendientes) {
      if (l.productoId != null) {
        const arr = pendProdMap.get(l.productoId) ?? [];
        arr.push(l.requisicion.folio);
        pendProdMap.set(l.productoId, arr);
      }
      if (l.presentacionId != null) {
        const arr = pendPresMap.get(l.presentacionId) ?? [];
        arr.push(l.requisicion.folio);
        pendPresMap.set(l.presentacionId, arr);
      }
    }

    // ===== Helper Decimal =====
    const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);

    // ===== 4) Construir DTO completo (para poder ordenar por priority/faltante etc.) =====
    const full: RequisitionProductCandidate[] = productos.map((p) => {
      const stockBase = stockBaseMap.get(p.id) ?? 0;

      let stockPresEq = D(0);
      const presentaciones = p.presentaciones.map((pp) => {
        const cantPres = stockPresMap.get(pp.id) ?? 0;
        const factor = D(pp.factorUnidadBase ?? 0);
        const eq = D(cantPres).mul(factor);

        stockPresEq = stockPresEq.add(eq);

        return {
          id: pp.id,
          nombre: pp.nombre,
          tipoPresentacion: pp.tipoPresentacion as TipoEmpaque,
          factorUnidadBase: D(pp.factorUnidadBase ?? 0).toString(),
          costoReferencialPresentacion:
            pp.costoReferencialPresentacion != null
              ? D(pp.costoReferencialPresentacion).toString()
              : null,
          sku: pp.sku,
          codigoBarras: pp.codigoBarras,
          esDefault: pp.esDefault,
          activo: pp.activo,
          stockCantidadPresentacion: cantPres,
          stockEquivalenteBase: eq.toString(),
          pendientesFolios: pendPresMap.get(pp.id) ?? [],
        };
      });

      const stockTotalEq = D(stockBase).add(stockPresEq);
      const stockMinimo = p.stockThreshold?.stockMinimo ?? 0;

      const belowThreshold = stockTotalEq.lessThan(D(stockMinimo));
      let faltanteSugerido = 0;
      if (belowThreshold) {
        const diff = D(stockMinimo).sub(stockTotalEq);
        faltanteSugerido = Math.max(diff.ceil().toNumber(), 1);
      }

      return {
        productoId: p.id,
        nombre: p.nombre,
        codigoProducto: p.codigoProducto ?? null,
        unidadBase: p.unidadBase,
        precioCostoProducto: p.precioCostoActual ?? null,

        stockBase,
        stockPresentacionesEq: stockPresEq.toString(),
        stockTotalEq: stockTotalEq.toString(),
        stockMinimo,
        belowThreshold,
        faltanteSugerido,

        pendientesProductoFolios: pendProdMap.get(p.id) ?? [],
        presentaciones,
      };
    });

    // ===== 5) Orden =====
    const dir = sortDir === 'desc' ? -1 : 1;
    const byNumber = (a: number, b: number) =>
      a === b ? 0 : a < b ? -1 * dir : 1 * dir;
    const byString = (a: string, b: string) => a.localeCompare(b, 'es') * dir;

    full.sort((a, b) => {
      if (sortBy === 'nombre') return byString(a.nombre, b.nombre);
      if (sortBy === 'codigoProducto')
        return byString(a.codigoProducto ?? '', b.codigoProducto ?? '');
      if (sortBy === 'stockMinimo')
        return byNumber(a.stockMinimo, b.stockMinimo);
      if (sortBy === 'stockTotalEq')
        return byNumber(Number(a.stockTotalEq), Number(b.stockTotalEq));
      if (sortBy === 'faltanteSugerido')
        return byNumber(a.faltanteSugerido, b.faltanteSugerido);

      // priority (default): críticos primero, luego mayor faltante, luego menor cobertura, luego nombre
      // críticos
      if (a.belowThreshold !== b.belowThreshold) {
        return a.belowThreshold ? -1 : 1;
      }
      // mayor faltante
      if (a.faltanteSugerido !== b.faltanteSugerido) {
        return (
          (b.faltanteSugerido - a.faltanteSugerido) * (dir === -1 ? -1 : 1)
        );
      }
      // menor cobertura = stockTotalEq / stockMinimo (si min=0 => +inf)
      const covA =
        a.stockMinimo > 0
          ? new Prisma.Decimal(a.stockTotalEq).div(a.stockMinimo).toNumber()
          : Number.POSITIVE_INFINITY;
      const covB =
        b.stockMinimo > 0
          ? new Prisma.Decimal(b.stockTotalEq).div(b.stockMinimo).toNumber()
          : Number.POSITIVE_INFINITY;
      if (covA !== covB) return (covA - covB) * dir;

      return byString(a.nombre, b.nombre);
    });

    // ===== 6) Paginar en memoria (más simple). Si el volumen crece, optimizar. =====
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const items = full.slice(start, end);

    return { items, page, pageSize, total, totalPages };
  }

  async getRequisicionForEdit(id: number): Promise<StockAlertItem[]> {
    const requisicionToEdit = await this.prisma.requisicion.findUnique({
      where: { id },
      select: {
        id: true,
        createdAt: true,
        lineas: {
          select: {
            fechaExpiracion: true,
            cantidadSugerida: true,
            producto: {
              select: {
                id: true,
                nombre: true,
                codigoProducto: true,
                precioCostoActual: true,
                stock: {
                  select: {
                    cantidad: true,
                  },
                },
                stockThreshold: {
                  select: {
                    stockMinimo: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!requisicionToEdit) return [];

    // Formatea el array como StockAlertItem[]
    const items: StockAlertItem[] = requisicionToEdit.lineas.map((linea) => {
      const producto = linea.producto;
      const stockActual = producto.stock?.reduce(
        (acc, item) => acc + item.cantidad,
        0,
      );

      const stockMinimo = producto.stockThreshold?.stockMinimo ?? 0;

      return {
        productoId: producto.id,
        nombre: producto.nombre,
        codigoProducto: producto.codigoProducto,
        id: producto.id,
        precioCosto: producto.precioCostoActual,
        stockActual,
        stockMinimo,
        cantidadSugerida: linea.cantidadSugerida, // Puedes permitir editar este campo
        fechaExpiracion: linea.fechaExpiracion,
      };
    });

    return items;
  }

  /* ---------- Paso C ---------- */
  /* ---------- Paso C (revisado para producto + presentaciones) ---------- */
  async createWithLines(dto: RequisicionLineasDTO) {
    try {
      const { lineas, sucursalId, usuarioId, observaciones } = dto;

      if (!lineas?.length) {
        throw new HttpException(
          { code: 'SIN_LINEAS', message: 'No se incluyeron productos' },
          HttpStatus.BAD_REQUEST,
        );
      }

      // Normalizar: producto vs presentación
      const productosRequisicion = lineas.filter(
        (l) => typeof l.productoId === 'number' && l.presentacionId == null,
      );
      const presentacionesRequisicion = lineas.filter(
        (l) => typeof l.presentacionId === 'number',
      );

      // Helper: fechas ancladas a GT
      const toFechaGT = (f?: string | Date | null) => {
        if (!f) return null;
        if (typeof f === 'string') {
          return dayjs.tz(f, 'YYYY-MM-DD', TZGT).startOf('day').toDate();
        }
        return dayjs(f).tz(TZGT).startOf('day').toDate();
      };

      // Helper: precios numéricos válidos
      const parsePrecio = (val: unknown) => {
        const n = typeof val === 'string' ? parseFloat(val) : Number(val);
        return Number.isFinite(n) && n > 0 ? n : null;
      };

      // Ejecuta todo en transacción
      const completa = await this.prisma.$transaction(async (tx) => {
        // 1) Actualizaciones de precios (sólo si pidieron actualizar y el precio es válido)
        await Promise.all([
          ...productosRequisicion.map(async (p) => {
            const nuevo = parsePrecio(p.precioCostoUnitario);
            if (nuevo && p.actualizarCosto && p.productoId) {
              await this.actualizarPrecioProducto(
                tx,
                nuevo,
                p.productoId,
                true,
              );
            }
          }),
          ...presentacionesRequisicion.map(async (pp) => {
            const nuevo = parsePrecio(pp.precioCostoUnitario);
            if (nuevo && pp.actualizarCosto && pp.presentacionId) {
              await this.actualizarPrecioPresentacion(
                tx,
                nuevo,
                pp.presentacionId,
                true,
              );
            }
          }),
        ]);

        // 2) Construir líneas de PRODUCTO
        const lineasProductoCreate = await Promise.all(
          productosRequisicion.map(
            async ({ productoId, cantidadSugerida, fechaExpiracion }) => {
              const producto = await tx.producto.findUnique({
                where: { id: productoId! },
                include: { stockThreshold: true },
              });
              if (!producto) {
                throw new HttpException(
                  { code: 'PRODUCTO_NO_ENCONTRADO', productoId },
                  HttpStatus.BAD_REQUEST,
                );
              }

              const stockBase = await tx.stock.aggregate({
                where: { productoId: productoId!, sucursalId },
                _sum: { cantidad: true },
              });

              const cantidadActualBase = Number(stockBase._sum.cantidad ?? 0);
              const stockMinimoProd = producto.stockThreshold?.stockMinimo ?? 0;
              const precioUnitario = Number(producto.precioCostoActual ?? 0); //USAR PRECIO DESDE LA BASE DE DATOS

              return {
                productoId: productoId!,
                presentacionId: null,
                cantidadActual: Math.max(0, cantidadActualBase),
                stockMinimo: stockMinimoProd,
                cantidadSugerida,
                precioUnitario,
                fechaExpiracion: toFechaGT(fechaExpiracion),
              };
            },
          ),
        );

        // 3) Construir líneas de PRESENTACIÓN
        const lineasPresentacionesCreate = await Promise.all(
          presentacionesRequisicion.map(
            async ({ presentacionId, cantidadSugerida, fechaExpiracion }) => {
              const presentacion = await tx.productoPresentacion.findUnique({
                where: { id: presentacionId! },
                include: { producto: { include: { stockThreshold: true } } },
              });
              if (!presentacion) {
                throw new HttpException(
                  { code: 'PRESENTACION_NO_ENCONTRADA', presentacionId },
                  HttpStatus.BAD_REQUEST,
                );
              }

              const { producto } = presentacion;
              const stockPresAgg = await tx.stockPresentacion.aggregate({
                where: { presentacionId: presentacionId!, sucursalId },
                _sum: { cantidadPresentacion: true },
              });
              const cantidadActualPres = Number(
                stockPresAgg._sum.cantidadPresentacion ?? 0,
              );

              const factor = Number(presentacion.factorUnidadBase || 0);
              const stockMinimoBase = producto.stockThreshold?.stockMinimo ?? 0;
              const stockMinimoPresentacion =
                factor > 0 ? Math.ceil(stockMinimoBase / factor) : 0;

              const costoRef =
                presentacion.costoReferencialPresentacion != null
                  ? Number(presentacion.costoReferencialPresentacion)
                  : null;
              const precioUnitario =
                costoRef ??
                Number(producto.precioCostoActual ?? 0) * (factor || 1);

              return {
                productoId: producto.id,
                presentacionId: presentacion.id,
                cantidadActual: Math.max(0, cantidadActualPres),
                stockMinimo: stockMinimoPresentacion,
                cantidadSugerida,
                precioUnitario,
                fechaExpiracion: toFechaGT(fechaExpiracion),
              };
            },
          ),
        );

        // 4) Total y persistencia
        const todasLasLineas = [
          ...lineasProductoCreate,
          ...lineasPresentacionesCreate,
        ];

        if (!todasLasLineas.length) {
          throw new HttpException(
            {
              code: 'SIN_LINEAS_VALIDAS',
              message: 'No hay líneas válidas (producto/presentación)',
            },
            HttpStatus.BAD_REQUEST,
          );
        }

        const totalRequisicion = todasLasLineas.reduce(
          (acc, l) =>
            acc +
            Number(l.precioUnitario || 0) * Number(l.cantidadSugerida || 0),
          0,
        );

        const cabecera = await tx.requisicion.create({
          data: {
            folio: '', // placeholder, se actualiza abajo
            sucursalId,
            usuarioId,
            observaciones: observaciones ?? '',
            totalLineas: todasLasLineas.length,
            totalRequisicion,
          },
        });

        const year = new Date().getFullYear();
        const folio = `REQ-${year}-${String(cabecera.id).padStart(4, '0')}`;

        // Inserta en bloque (createMany no soporta connect, pero no lo necesitamos)
        await tx.requisicionLinea.createMany({
          data: todasLasLineas.map((l) => ({
            requisicionId: cabecera.id,
            productoId: l.productoId,
            presentacionId: l.presentacionId ?? null,
            cantidadActual: l.cantidadActual,
            stockMinimo: l.stockMinimo,
            cantidadSugerida: l.cantidadSugerida,
            precioUnitario: l.precioUnitario,
            fechaExpiracion: l.fechaExpiracion, // Date | null
          })),
        });

        const completa = await tx.requisicion.update({
          where: { id: cabecera.id },
          data: { folio },
          include: {
            lineas: true,
            sucursal: true,
            usuario: true,
          },
        });

        return completa;
      });

      // 👈 devuelve lo que regresó la transacción
      return completa;
    } catch (error) {
      this.logger.error('createWithLines error', error);
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Fatal error: Error inesperado');
    }
  }

  create(createRequisicionDto: CreateRequisicionDto) {
    return 'This action adds a new requisicion';
  }

  async findAll() {
    try {
      const requisiciones = await this.prisma.requisicion.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          folio: true,
          fecha: true,
          sucursalId: true,
          usuarioId: true,
          estado: true,
          observaciones: true,
          totalLineas: true,
          totalRequisicion: true, // podría ser null si aún no lo calculaste
          createdAt: true,
          updatedAt: true,
          ingresadaAStock: true,
          usuario: {
            select: {
              id: true,
              nombre: true,
              rol: true,
            },
          },
          sucursal: {
            select: {
              id: true,
              nombre: true,
            },
          },
          lineas: {
            select: {
              id: true,
              productoId: true,
              presentacionId: true,
              cantidadActual: true,
              stockMinimo: true,
              cantidadSugerida: true,
              precioUnitario: true, // Float? en tu schema actual
              fechaExpiracion: true,
              createdAt: true,
              updatedAt: true,
              producto: {
                select: {
                  id: true,
                  codigoProducto: true,
                  nombre: true,
                  precioCostoActual: true, // Float?
                },
              },
              presentacion: {
                select: {
                  id: true,
                  nombre: true,
                  factorUnidadBase: true, // Decimal(18,6)
                  sku: true,
                  codigoBarras: true,
                  tipoPresentacion: true,
                  costoReferencialPresentacion: true, // Decimal(12,4)?
                },
              },
            },
          },
        },
      });

      // Adaptar la forma para UI (strings de fecha, totales, etc.)
      const dto = requisiciones.map((r) => {
        // map de líneas
        const lineas = r.lineas.map((l) => {
          // precio "usable" para subtotal (fallback a costo referencial de presentación o costo base * factor)
          const precioDeLinea =
            typeof l.precioUnitario === 'number'
              ? l.precioUnitario
              : (() => {
                  if (l.presentacion) {
                    const costoRef = l.presentacion.costoReferencialPresentacion
                      ? Number(l.presentacion.costoReferencialPresentacion)
                      : null;
                    if (costoRef != null) return costoRef;
                    const factor = Number(l.presentacion.factorUnidadBase ?? 1);
                    return (
                      (r?.lineas?.[0]?.producto?.precioCostoActual ?? 0) *
                      factor
                    );
                  }
                  return l.producto?.precioCostoActual ?? 0;
                })();

          const subtotal = precioDeLinea * (l.cantidadSugerida ?? 0);

          return {
            id: l.id,
            productoId: l.productoId,
            presentacionId: l.presentacionId ?? null,
            esPresentacion: l.presentacionId != null,
            cantidadActual: l.cantidadActual,
            stockMinimo: l.stockMinimo,
            cantidadSugerida: l.cantidadSugerida,
            precioUnitario: precioDeLinea,
            subtotal,

            fechaExpiracion: l.fechaExpiracion
              ? l.fechaExpiracion.toISOString()
              : null,
            createdAt: l.createdAt.toISOString(),
            updatedAt: l.updatedAt.toISOString(),

            producto: {
              id: l.producto.id,
              codigoProducto: l.producto.codigoProducto,
              nombre: l.producto.nombre,
              precioCostoActual: l.producto.precioCostoActual ?? 0,
            },

            presentacion: l.presentacion
              ? {
                  id: l.presentacion.id,
                  nombre: l.presentacion.nombre,
                  factorUnidadBase: Number(l.presentacion.factorUnidadBase),
                  sku: l.presentacion.sku,
                  codigoBarras: l.presentacion.codigoBarras,
                  tipoPresentacion: l.presentacion.tipoPresentacion,
                  costoReferencialPresentacion:
                    l.presentacion.costoReferencialPresentacion != null
                      ? Number(l.presentacion.costoReferencialPresentacion)
                      : null,
                }
              : null,
          };
        });

        // totalRequisicion calculado si viene null
        const totalCalc =
          r.totalRequisicion != null
            ? Number(r.totalRequisicion)
            : lineas.reduce((acc, x) => acc + (x.subtotal ?? 0), 0);

        return {
          id: r.id,
          folio: r.folio,
          fecha: r.fecha.toISOString(),
          sucursalId: r.sucursalId,
          usuarioId: r.usuarioId,
          estado: r.estado,
          observaciones: r.observaciones ?? null,

          totalLineas: r.totalLineas,
          totalRequisicion: totalCalc,

          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),

          ingresadaAStock: r.ingresadaAStock,

          usuario: r.usuario,
          sucursal: r.sucursal,
          lineas,
        };
      });

      return dto;
    } catch (error) {
      this.logger?.error?.('[findAll requisiciones] ', error);
      throw error;
    }
  }

  async getRequisicionesFull() {
    try {
      const requisiciones = await this.prisma.requisicion.findMany({
        include: {
          usuario: {
            select: {
              id: true,
              nombre: true,
              rol: true,
            },
          },
          lineas: {
            select: {
              id: true,
              cantidadActual: true,
              cantidadSugerida: true,
              createdAt: true,
              precioUnitario: true,
              stockMinimo: true,
              updatedAt: true,
              producto: {
                select: {
                  id: true,
                  codigoProducto: true,
                  nombre: true,
                },
              },
            },
          },
          sucursal: {
            select: {
              id: true,
              nombre: true,
            },
          },
        },
      });
      return requisiciones;
    } catch (error) {
      console.log(error);
      return error;
    }
  }

  /**
   *
   * @param id ID del registro de requisicion para retornar informacion y generar un PDF
   * @returns informacion de registro requisicion mediante su flujo de trabajo (finalizado o no)
   */
  async findOne(id: number) {
    try {
      const requisiciones = await this.prisma.requisicion.findUnique({
        where: {
          id,
        },
        include: {
          usuario: {
            select: {
              id: true,
              nombre: true,
              rol: true,
            },
          },
          lineas: {
            select: {
              id: true,
              cantidadActual: true,
              cantidadSugerida: true,
              cantidadRecibida: true,
              createdAt: true,
              precioUnitario: true,
              stockMinimo: true,
              updatedAt: true,
              fechaExpiracion: true,

              producto: {
                select: {
                  id: true,
                  codigoProducto: true,
                  nombre: true,
                },
              },
            },
          },
          sucursal: {
            select: {
              id: true,
              nombre: true,
            },
          },
        },
      });

      console.log('Los registros son: ', requisiciones);

      return requisiciones;
    } catch (error) {
      console.log(error);
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException({
        message: 'Fatal error: Error inesperado XD',
      });
    }
  }

  update(id: number, updateRequisicionDto: UpdateRequisicionDto) {
    return `This action updates a #${id} requisicion`;
  }

  async remove(id: number) {
    try {
      console.log('Entrando al remove de requisiciones');

      if (!id) {
        throw new NotFoundException(
          'Error al encontrar registro de requisicion',
        );
      }

      const requisicionToDelete = await this.prisma.requisicion.delete({
        where: {
          id,
        },
      });
      return requisicionToDelete;
    } catch (error) {
      console.log(error);
      return error;
    }
  }

  async generateRequsicionStock(id: number) {
    console.log();
  }

  async updateRequisitionWithLines(dto: UpdateRequisitionDto) {
    const { requisicionId, sucursalId, usuarioId, lineas } = dto;

    if (!lineas.length) {
      throw new BadRequestException(
        'No se incluyeron líneas para la requisición',
      );
    }

    // Verificar que exista la requisición
    const requisicion = await this.prisma.requisicion.findUnique({
      where: { id: requisicionId },
      include: { lineas: true },
    });
    if (!requisicion) throw new NotFoundException('Requisición no encontrada');

    // Armar nuevas líneas con precios actuales
    const nuevasLineas = await Promise.all(
      lineas.map(async ({ productoId, cantidadSugerida, fechaExpiracion }) => {
        const threshold = await this.prisma.stockThreshold.findFirst({
          where: { productoId },
          include: {
            producto: { select: { precioCostoActual: true } },
          },
        });
        if (!threshold) {
          throw new BadRequestException(
            `No hay umbral para producto ${productoId}`,
          );
        }

        return {
          productoId,
          cantidadSugerida,
          precioUnitario: threshold.producto.precioCostoActual,
          stockMinimo: threshold.stockMinimo,
          fechaExpiracion,
        };
      }),
    );

    const totalRequisicion = nuevasLineas.reduce(
      (acc, l) => acc + l.precioUnitario * l.cantidadSugerida,
      0,
    );

    const actualizada = await this.prisma.$transaction(async (tx) => {
      // 1. Borra líneas viejas
      await tx.requisicionLinea.deleteMany({
        where: { requisicionId },
      });

      // 2. Crea nuevas líneas una por una y guarda sus IDs
      const nuevasLineasIds: number[] = [];
      for (const l of nuevasLineas) {
        const { _sum } = await tx.stock.aggregate({
          where: { productoId: l.productoId, sucursalId },
          _sum: { cantidad: true },
        });

        const fechaExp = l.fechaExpiracion
          ? dayjs(l.fechaExpiracion)
              .tz('America/Guatemala')
              .startOf('day')
              .toDate()
          : null;

        await tx.requisicionLinea.create({
          data: {
            ...l,
            requisicionId,
            cantidadActual: _sum.cantidad ?? 0,
            fechaExpiracion: fechaExp,
          },
        });
      }

      const requisicionActualizada = await tx.requisicion.update({
        where: { id: requisicionId },
        data: {
          sucursalId,
          usuarioId,
          totalLineas: nuevasLineas.length,
          totalRequisicion,
        },
        include: { lineas: true, sucursal: true, usuario: true },
      });

      return requisicionActualizada;
    });

    return {
      ...actualizada,
      fecha: actualizada.fecha?.toISOString(),
      estado: 'PENDIENTE',
    };
  }
}
