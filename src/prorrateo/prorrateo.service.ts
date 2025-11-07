import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ListProrrateoDto } from './dto/list-prorrateo.dto';
import { UpdateProrrateoDto } from './dto/update-prorrateo.dto';
import { EstadoProrrateo } from '@prisma/client';

@Injectable()
export class ProrrateoService {
  private readonly logger = new Logger(ProrrateoService.name);
  constructor(private readonly prisma: PrismaService) {}

  /** Listado con filtros/paginación */
  async findAll(q: ListProrrateoDto) {
    const {
      page = 1,
      limit = 20,
      sucursalId,
      compraId,
      entregaStockId,
      requisicionRecepcionId,
      movimientoFinancieroId,
      estado,
      metodo,
      includeDetalles,
    } = q;

    const where: any = {
      sucursalId: sucursalId ?? undefined,
      compraId: compraId ?? undefined,
      entregaStockId: entregaStockId ?? undefined,
      compraRecepcionId: requisicionRecepcionId ?? undefined,
      movimientoFinancieroId: movimientoFinancieroId ?? undefined,
      estado: estado ?? undefined,
      metodo: metodo ?? undefined,
    };

    const take = Math.min(Math.max(+limit, 1), 200);
    const skip = (Math.max(+page, 1) - 1) * take;

    // helper numérico

    const [total, rowsRaw] = await this.prisma.$transaction([
      this.prisma.prorrateo.count({ where }),
      this.prisma.prorrateo.findMany({
        where,
        orderBy: { creadoEn: 'desc' },
        take,
        skip,
        include:
          includeDetalles === 'true'
            ? {
                detalles: {
                  select: {
                    id: true,
                    // cantidades y montos
                    cantidadBase: true,
                    valorBase: true,
                    montoAsignado: true,
                    // costos
                    precioCostoAntes: true,
                    precioCostoDesp: true,
                    gastoUnitarioBase: true, // a (G/T)
                    costoFacturaUnitario: true, // cᵢ
                    gastoUnitarioAplicado: true, // a_target (siempre = a)
                    costoUnitarioResultante: true, // uᵢ
                    inversionLinea: true, // Lᵢ
                    creadoEn: true,
                    // identificadores de lote
                    stockId: true,
                    stockPresentacionId: true,
                    // para exponer producto/presentación
                    stock: {
                      select: {
                        id: true,
                        productoId: true,
                        sucursalId: true,
                        cantidadInicial: true,
                        cantidad: true,
                        costoTotal: true,
                        precioCosto: true,
                      },
                    },
                    stockPresentacion: {
                      select: {
                        id: true,
                        productoId: true,
                        presentacionId: true,
                        cantidadPresentacion: true,
                        precioCosto: true,
                        costoTotal: true,
                      },
                    },
                  },
                  orderBy: { id: 'asc' },
                },
              }
            : undefined,
      }),
    ]);

    // ===== Transformación “estilo Excel”
    // ===== Transformación “como Excel”
    const N = (x: any) => (Number.isFinite(Number(x)) ? Number(x) : 0);

    const data = rowsRaw.map((pr) => {
      if (includeDetalles !== 'true') return pr;

      const dets = pr.detalles ?? [];

      // Cabecera (G, T, a)
      const T = dets.reduce((s, d) => s + N(d.cantidadBase), 0);
      const G = N(pr.montoTotal);
      const a = T > 0 ? +(G / T).toFixed(4) : 0;

      const gastoAsignadoTotal = +dets
        .reduce((s, d) => s + N(d.montoAsignado), 0)
        .toFixed(4);
      const costoProrrateadoTotalInversion = +dets
        .reduce((s, d) => {
          const u = N(d.costoUnitarioResultante) || N(d.precioCostoDesp);
          return s + N(d.cantidadBase) * u;
        }, 0)
        .toFixed(4);

      const lineas = dets.map((d) => {
        const isPres = !!d.stockPresentacionId;
        const productoId = isPres
          ? (d.stockPresentacion?.productoId ?? null)
          : (d.stock?.productoId ?? null);
        const presentacionId = isPres
          ? (d.stockPresentacion?.presentacionId ?? null)
          : null;

        const costoUnitarioDeGastoAsociado = N(d.gastoUnitarioAplicado) || a;
        const precioCostoUnitario = N(d.costoFacturaUnitario);
        const costoMasGastoAsociado =
          N(d.costoUnitarioResultante) ||
          +(precioCostoUnitario + costoUnitarioDeGastoAsociado).toFixed(4);
        const totalInversion =
          N(d.inversionLinea) ||
          +(N(d.cantidadBase) * costoMasGastoAsociado).toFixed(4);

        // Si no hubo stock previo para ese producto, esto es igual al “prorrateado”
        const costoUnitarioProrrateado = costoMasGastoAsociado;

        return {
          id: d.id,
          target: d.stockId
            ? { tipo: 'STOCK' as const, id: d.stockId }
            : { tipo: 'STOCK_PRES' as const, id: d.stockPresentacionId! },

          productoId,
          presentacionId,

          // === columnas “tal cual Excel” ===
          cantidad: N(d.cantidadBase),
          precioCostoUnitario,
          costoUnitarioDeGastoAsociado,
          costoMasGastoAsociado,
          totalInversion,
          gastoAsignado: +N(d.montoAsignado).toFixed(4),

          // auxiliares para auditoría
          precioCostoAntes: +N(d.precioCostoAntes).toFixed(4),
          precioCostoDespues: +N(d.precioCostoDesp).toFixed(4),
          costoUnitarioProrrateado, // útil cuando no hay previos
          createdAt: d.creadoEn,
        };
      });

      return {
        id: pr.id,
        sucursalId: pr.sucursalId,
        metodo: pr.metodo,
        estado: pr.estado,
        comentario: pr.comentario,
        creadoEn: pr.creadoEn,

        // === cabecera “tal cual Excel” ===
        cabecera: {
          gastosAsociadosPedido: G,
          totalNuevas: T, // = “total nuevas”
          nuevasExistencias: T, // alias útil
          costoUnitarioDeGastoAsociado: a, // a = G/T
          gastoAsignadoTotal,
          costoProrrateadoTotalInversion,
        },

        lineas,
      };
    });

    return {
      meta: {
        page: +page,
        limit: take,
        total,
        pages: Math.max(Math.ceil(total / take), 1),
      },
      data,
    };
  }

  /** Detalle por id (incluye detalles + stock info) */
  async findOne(id: number) {
    const pr = await this.prisma.prorrateo.findUnique({
      where: { id },
      include: {
        detalles: {
          include: {
            stock: {
              select: {
                id: true,
                productoId: true,
                sucursalId: true,
                cantidadInicial: true,
                cantidad: true,
                costoTotal: true,
                precioCosto: true,
              },
            },
          },
          orderBy: { id: 'asc' },
        },
      },
    });
    if (!pr) throw new NotFoundException('Prorrateo no encontrado');
    return pr;
  }

  /** Todos los prorrateos que afectaron un stock */
  async findByStock(stockId: number) {
    const detalles = await this.prisma.prorrateoDetalle.findMany({
      where: { stockId },
      include: {
        prorrateo: true,
      },
      orderBy: { id: 'asc' },
    });
    return detalles;
  }

  /**
   * Stocks con existencias (>0) + resumen de prorrateo
   * - sumaAsignado: SUM(ProrrateoDetalle.montoAsignado)
   * - ultimaFecha: MAX(Prorrateo.creadoEn) para ese stock
   */
  async stocksConProrrateo(input: {
    sucursalId: number;
    page: number;
    limit: number;
    productoId?: number;
  }) {
    const { sucursalId, page, limit, productoId } = input;
    if (!sucursalId) throw new BadRequestException('sucursalId requerido');

    const take = Math.min(Math.max(limit, 1), 200);
    const skip = (Math.max(page, 1) - 1) * take;

    // 1) Stocks con existencias
    const whereStock: any = {
      sucursalId,
      cantidad: { gt: 0 },
      productoId: productoId ?? undefined,
    };

    const [total, stocks] = await this.prisma.$transaction([
      this.prisma.stock.count({ where: whereStock }),
      this.prisma.stock.findMany({
        where: whereStock,
        orderBy: { id: 'desc' },
        take,
        skip,
        select: {
          id: true,
          productoId: true,
          sucursalId: true,
          cantidadInicial: true,
          cantidad: true,
          costoTotal: true,
          precioCosto: true,
        },
      }),
    ]);

    if (!stocks.length) {
      return {
        meta: {
          page,
          limit: take,
          total,
          pages: Math.max(Math.ceil(total / take), 1),
        },
        data: [],
      };
    }

    const stockIds = stocks.map((s) => s.id);

    // 2) GroupBy ProrrateoDetalle para sumar asignado por stock
    const sumByStock = await this.prisma.prorrateoDetalle.groupBy({
      by: ['stockId'],
      where: { stockId: { in: stockIds } },
      _sum: { montoAsignado: true },
    });

    // 3) Última fecha de prorrateo por stock
    const ultimas = await this.prisma.prorrateoDetalle.findMany({
      where: { stockId: { in: stockIds } },
      select: { stockId: true, prorrateo: { select: { creadoEn: true } } },
      orderBy: { id: 'desc' },
    });

    const sumMap = new Map(
      sumByStock.map((s) => [s.stockId, s._sum.montoAsignado ?? 0]),
    );
    const lastMap = new Map<number, Date>();
    for (const r of ultimas) {
      if (!lastMap.has(r.stockId) && r.prorrateo?.creadoEn) {
        lastMap.set(r.stockId, r.prorrateo.creadoEn);
      }
    }

    const data = stocks.map((s) => ({
      ...s,
      prorrateo: {
        sumaAsignado: Number(sumMap.get(s.id) ?? 0),
        ultimaFecha: lastMap.get(s.id) ?? null,
      },
    }));

    return {
      meta: {
        page,
        limit: take,
        total,
        pages: Math.max(Math.ceil(total / take), 1),
      },
      data,
    };
  }

  /** Cambiar comentario / anular prorrateo (sin revertir costos en este método) */
  async update(id: number, dto: UpdateProrrateoDto) {
    const pr = await this.prisma.prorrateo.findUnique({
      where: { id },
      include: { detalles: true },
    });
    if (!pr) throw new NotFoundException('Prorrateo no encontrado');

    // Si se solicita anular, validamos que no existan prorrateos posteriores sobre esos mismos stocks (seguridad básica)
    if (dto.estado === EstadoProrrateo.ANULADO) {
      const stockIds = pr.detalles.map((d) => d.stockId);
      if (stockIds.length) {
        const posterior = await this.prisma.prorrateoDetalle.findFirst({
          where: {
            stockId: { in: stockIds },
            prorrateo: { creadoEn: { gt: pr.creadoEn } },
          },
          select: { id: true },
        });
        if (posterior) {
          throw new ConflictException(
            'No se puede anular: existen prorrateos posteriores en alguno de los stocks.',
          );
        }
      }
    }

    const updated = await this.prisma.prorrateo.update({
      where: { id },
      data: {
        estado: dto.estado ?? undefined,
        comentario: dto.comentario ?? undefined,
      },
      include: { detalles: true },
    });

    return updated;
  }

  /**
   * “Eliminar” => anular.
   * Si quieres revertir costos, crea otro método específico para rollback transaccional.
   */
  async remove(id: number) {
    return this.update(id, { estado: EstadoProrrateo.ANULADO });
  }

  async removeAll() {
    return await this.prisma.prorrateo.deleteMany({});
  }
}
