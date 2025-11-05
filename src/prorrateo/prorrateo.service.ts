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
      requisicionRecepcionId: requisicionRecepcionId ?? undefined,
      movimientoFinancieroId: movimientoFinancieroId ?? undefined,
      estado: estado ?? undefined,
      metodo: metodo ?? undefined,
    };

    const take = Math.min(Math.max(limit, 1), 200);
    const skip = (Math.max(page, 1) - 1) * take;

    const [total, rows] = await this.prisma.$transaction([
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
              }
            : undefined,
      }),
    ]);

    return {
      meta: {
        page,
        limit: take,
        total,
        pages: Math.max(Math.ceil(total / take), 1),
      },
      data: rows,
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
