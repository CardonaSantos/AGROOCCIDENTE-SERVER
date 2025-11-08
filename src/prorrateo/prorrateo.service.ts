import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  HttpException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ListProrrateoDto } from './dto/list-prorrateo.dto';
import { UpdateProrrateoDto } from './dto/update-prorrateo.dto';
import { EstadoProrrateo, Prisma } from '@prisma/client';
import { MappedDetalle, MappedProrrateo } from './interfaces/interfaces';
import { DtoGenProrrateo } from './dto/DtoGenProrrateo';

//helpers
const n = (x: any) => Number(x ?? 0);
const r2 = (x: number | null | undefined) =>
  x == null ? null : Math.round((x + Number.EPSILON) * 100) / 100;

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
        const costoUnitarioProrrateado = costoMasGastoAsociado; //ajustariamos encontrando las existencias pasadas con las nuevas que metimos , probablemente insertadas o guardado el registro en el prorrateo
        const costoUnitarioProrrateadoReal =
          costoProrrateadoTotalInversion / 25;
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
          costoUnitarioProrrateado: costoUnitarioProrrateadoReal, // útil cuando no hay previos
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

  async findAllRawRegist() {
    const n = (x: any) => (Number.isFinite(Number(x)) ? Number(x) : 0);
    const r2 = (x: any) => Math.round(n(x) * 100) / 100;

    const raw = await this.prisma.prorrateo.findMany({
      orderBy: { id: 'desc' },
      select: {
        id: true,
        comentario: true,
        estado: true,
        metodo: true,
        montoTotal: true,
        creadoEn: true,
        movimientoFinanciero: true,
        entregaStock: { select: { id: true, montoTotal: true } },
        detalles: {
          select: {
            id: true,
            creadoEn: true,

            // === base (siguen existiendo, ahora opcionales con default 0) ===
            cantidadBase: true,
            valorBase: true,
            montoAsignado: true,
            precioCostoAntes: true,
            precioCostoDesp: true,
            costoFacturaUnitario: true,
            costoUnitarioResultante: true,
            gastoUnitarioBase: true,
            gastoUnitarioAplicado: true,
            inversionLinea: true,

            // === snapshots “tipo Excel” (nuevos) ===
            existenciasPrevias: true,
            inversionPrevias: true,
            nuevasExistencias: true,
            costoProrrateadoTotalInversion: true,
            costoUnitarioProrrateado: true,

            // === lotes ===
            stock: {
              select: {
                id: true,
                creadoEn: true,
                cantidad: true,
                cantidadInicial: true,
                precioCosto: true,
                fechaIngreso: true,
                costoTotal: true,
                fechaVencimiento: true,
                producto: { select: { id: true, nombre: true } },
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
        },
      },
    });

    return raw.map((p) => {
      const T = p.detalles.reduce((s, d) => s + n(d.cantidadBase), 0); // total nuevas (UNIDADES)
      const G = n(p.montoTotal); // gastos asociados (cabecera)
      const aCab = T > 0 ? G / T : 0; // a = G/T

      const detalles = p.detalles.map((d) => {
        // 1) Datos “de factura” / unitarios
        const cantidad = n(d.cantidadBase);
        const a = n(d.gastoUnitarioAplicado) || n(d.gastoUnitarioBase) || aCab;
        const cFactura = n(d.costoFacturaUnitario) || n(d.precioCostoAntes);
        const u = n(d.costoUnitarioResultante) || cFactura + a;
        const montoAsignado = n(d.montoAsignado) || r2(cantidad * a);
        const inversionLinea = n(d.inversionLinea) || r2(cantidad * u);

        // 2) Snapshots “tipo Excel” (con fallback si faltan)
        const existPrev = n(d.existenciasPrevias); // puede ser 0 primera vez
        const invPrev =
          n(d.inversionPrevias) ||
          r2(existPrev * (n(d.precioCostoAntes) || cFactura));
        const nuevasExist = n(d.nuevasExistencias) || existPrev + cantidad;
        const invAcum =
          n(d.costoProrrateadoTotalInversion) || r2(invPrev + inversionLinea);
        const cpuSnap =
          n(d.costoUnitarioProrrateado) ||
          (nuevasExist > 0 ? r2(invAcum / nuevasExist) : u);

        // 3) Para controles (sin valorBase; usamos proporción por UNIDADES)
        const part = T > 0 ? cantidad / T : 0;
        const montoAsignadoEsperado = r2(G * part);
        const diffAsignacion = r2(montoAsignado - montoAsignadoEsperado);

        // 4) Lote/Producto
        const isPres = !!d.stockPresentacion;
        const productoId = isPres
          ? n(d.stockPresentacion?.productoId)
          : n(d.stock?.producto?.id);
        const productoName = isPres
          ? null
          : (d.stock?.producto?.nombre ?? null);
        const stockId = isPres ? n(d.stockPresentacion?.id) : n(d.stock?.id);

        // 5) Costo total recalculado según costoUnitarioResultante
        const cantidadStock = isPres
          ? n(d.stockPresentacion?.cantidadPresentacion)
          : n(d.stock?.cantidad);
        const baseCostoFinal =
          n(d.precioCostoDesp) || u || n(d.stock?.precioCosto);
        const costoTotalRecalc = r2(cantidadStock * baseCostoFinal);
        const costoTotalGuardado = isPres
          ? n(d.stockPresentacion?.costoTotal)
          : n(d.stock?.costoTotal);
        const diffCostoTotal = r2(costoTotalGuardado - costoTotalRecalc);

        return {
          detalleId: d.id,
          stockId,
          productoId,
          productoNombre: productoName,

          // === columnas “Excel” por línea ===
          cantidadBase: cantidad,
          precioCostoUnitario: cFactura,
          costoUnitarioDeGastoAsociado: a,
          costoMasGastoAsociado: r2(u),
          totalInversion: r2(inversionLinea), // Lᵢ
          gastoAsignado: r2(montoAsignado),

          // snapshots
          existenciasPrevias: existPrev,
          inversionPrevias: r2(invPrev),
          nuevasExistencias: nuevasExist,
          costoProrrateadoTotalInversion: r2(invAcum),
          costoUnitarioProrrateado: cpuSnap,

          // auxiliares/controles
          precioCostoAntes: n(d.precioCostoAntes),
          precioCostoDespues: n(d.precioCostoDesp) || r2(u),
          montoAsignadoEsperado,
          diffAsignacion,
          costoTotalStock: costoTotalGuardado,
          costoTotalRecalc,
          diffCostoTotal,

          creadoEnDetalle: d.creadoEn ?? null,
        };
      });

      // ===== Sumas de control a nivel cabecera
      const sumaCantidadBase = detalles.reduce(
        (s, x) => s + n(x.cantidadBase),
        0,
      );
      const gastoAsignadoTotal = detalles.reduce(
        (s, x) => s + n(x.gastoAsignado),
        0,
      );
      const inversionTotal = detalles.reduce(
        (s, x) => s + n(x.totalInversion),
        0,
      );

      return {
        prorrateoId: p.id,
        comentario: p.comentario ?? null,
        estado: p.estado,
        metodo: p.metodo,
        creadoEn: p.creadoEn,
        movimientoFinanciero: p.movimientoFinanciero,
        entregaStock: {
          id: p.entregaStock?.id ?? null,
          montoTotal: p.entregaStock?.montoTotal ?? null,
        },

        // === cabecera estilo Excel ===
        cabecera: {
          gastosAsociadosPedido: r2(G),
          totalNuevas: sumaCantidadBase, // T
          costoUnitarioDeGastoAsociado: r2(aCab), // a = G/T
          gastoAsignadoTotal: r2(gastoAsignadoTotal), // suma de montos asignados
          costoProrrateadoTotalInversion: r2(
            detalles.reduce(
              (s, x) => s + n(x.costoProrrateadoTotalInversion),
              0,
            ),
          ), // suma de invAcum por línea (útil para auditoría)
        },

        // detalle
        detalles,
      };
    });
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

  //---------------------UTILITARIO---------------------------->
  // Wrapper público (lo puedes seguir usando fuera de otras transacciones)
  async generarProrrateoUnidades(dto: DtoGenProrrateo) {
    if (dto.aplicarProrrateo === true) {
      return this.prisma.$transaction(async (tx) => {
        return this.generarProrrateoUnidadesTx(tx, dto);
      });
    }
    this.logger.log('Flag para no hacer prorrrateo');
  }
  // Helper real que NO abre transacción; usa la que le pases
  async generarProrrateoUnidadesTx(
    tx: Prisma.TransactionClient,
    dto: DtoGenProrrateo,
  ) {
    if (dto.aplicarProrrateo === false) {
      return;
    }
    this.logger.log(
      `DTO recibido en generarProrrateoUnidadesTx:\n${JSON.stringify(dto, null, 2)}`,
    );

    const N = (x: any) => {
      const v = Number(x);
      return Number.isFinite(v) ? v : 0;
    };

    // 0) Idempotencia por MF (usar el mismo tx!)
    if (dto.movimientoFinancieroId) {
      const dup = await tx.prorrateo.findUnique({
        where: { movimientoFinancieroId: dto.movimientoFinancieroId },
      });
      if (dup) return dup;
    }

    const G = Number(dto.gastosAsociadosCompra ?? 0);
    if (G < 0) throw new Error('gastosAsociadosCompra no puede ser negativo');

    // ==========================
    // MODO A: por CompraRecepcion
    // ==========================
    if (dto.compraRecepcionId) {
      const recep = await tx.compraRecepcion.findUnique({
        where: { id: dto.compraRecepcionId },
        include: {
          compra: { select: { id: true } },
          lineas: {
            select: {
              id: true,
              productoId: true,
              presentacionId: true,
              cantidadRecibida: true,
              stockPresentacionId: true,
              compraDetalle: { select: { costoUnitario: true } },
            },
          },
        },
      });
      if (!recep) throw new Error('Recepción no encontrada');
      if (!recep.lineas.length) throw new Error('Recepción sin líneas');

      const T = recep.lineas.reduce((s, ln) => s + N(ln.cantidadRecibida), 0);
      if (T <= 0) throw new Error('No hay unidades para prorratear');
      const a = G / T;

      const pr = await tx.prorrateo.create({
        data: {
          sucursalId: dto.sucursalId,
          metodo: 'UNIDADES',
          montoTotal: G,
          compraId: recep.compra?.id ?? dto.compraId ?? null,
          compraRecepcionId: recep.id,
          entregaStockId: dto.entregaStockId ?? null,
          movimientoFinancieroId: dto.movimientoFinancieroId ?? null,
          comentario: dto.comentario ?? null,
        },
      });

      // Nota: en MODO A hacemos snapshot "por línea" (seguro para recepciones donde no
      // tenemos todos los ids de lotes nuevos enlazados). En MODO B abajo lo hacemos
      // "agrupado por producto" (pool).
      for (const ln of recep.lineas) {
        const cantidad = N(ln.cantidadRecibida);
        if (cantidad <= 0) continue;

        const cFactura = N(ln.compraDetalle.costoUnitario);
        const u = cFactura + a; // costo unitario resultante
        const inversionLinea = cantidad * u; // Lᵢ
        const montoAsignado = cantidad * a; // porción de G para la línea

        if (ln.presentacionId) {
          // === Presentación ===
          const lotePres = await tx.stockPresentacion.findUnique({
            where: { id: ln.stockPresentacionId! },
            select: {
              id: true,
              precioCosto: true,
              productoId: true,
              presentacionId: true,
              sucursalId: true,
            },
          });
          if (!lotePres)
            throw new Error(
              `StockPresentacion ${ln.stockPresentacionId} no encontrado`,
            );
          const precioAntes = N(lotePres.precioCosto);

          // Previos del mismo producto en la sucursal (excluyendo ESTE lote)
          const prevBase = await tx.stock.findMany({
            where: {
              productoId: lotePres.productoId,
              sucursalId: lotePres.sucursalId,
              cantidad: { gt: 0 },
            },
            select: { cantidad: true, precioCosto: true },
          });
          const prevPres = await tx.stockPresentacion.findMany({
            where: {
              productoId: lotePres.productoId,
              sucursalId: lotePres.sucursalId,
              id: { not: lotePres.id },
              cantidadPresentacion: { gt: 0 },
            },
            select: { cantidadPresentacion: true, precioCosto: true },
          });

          const existPrev =
            prevBase.reduce((s, r) => s + N(r.cantidad), 0) +
            prevPres.reduce((s, r) => s + N(r.cantidadPresentacion), 0);

          const invPrev =
            prevBase.reduce((s, r) => s + N(r.cantidad) * N(r.precioCosto), 0) +
            prevPres.reduce(
              (s, r) => s + N(r.cantidadPresentacion) * N(r.precioCosto),
              0,
            );

          const nuevasExist = existPrev + cantidad;
          const invAcum = invPrev + inversionLinea;
          const cpu = nuevasExist > 0 ? invAcum / nuevasExist : u;

          await tx.stockPresentacion.update({
            where: { id: lotePres.id },
            data: { precioCosto: u },
          });

          await tx.prorrateoDetalle.create({
            data: {
              prorrateoId: pr.id,
              stockPresentacionId: lotePres.id,

              // cantidades y montos base
              cantidadBase: cantidad,
              valorBase: 0,
              montoAsignado,

              // costos "antes/después" y componentes
              precioCostoAntes: precioAntes,
              precioCostoDesp: u,
              gastoUnitarioBase: a, // a = G/T
              costoFacturaUnitario: cFactura, // cᵢ
              gastoUnitarioAplicado: a, // usado
              costoUnitarioResultante: u, // u = cᵢ + a
              inversionLinea, // Lᵢ

              // snapshots de producto
              existenciasPrevias: existPrev,
              inversionPrevias: +invPrev.toFixed(4),
              nuevasExistencias: nuevasExist,
              costoProrrateadoTotalInversion: +invAcum.toFixed(4),
              costoUnitarioProrrateado: +cpu.toFixed(6),
            },
          });
        } else {
          // === Producto base ===
          const loteBase = await tx.stock.findFirst({
            where: { compraRecepcionId: recep.id, productoId: ln.productoId! },
            orderBy: { id: 'desc' },
            select: {
              id: true,
              precioCosto: true,
              productoId: true,
              sucursalId: true,
            },
          });
          if (!loteBase) {
            throw new Error(
              `No se encontró lote base para producto ${ln.productoId} en recep ${recep.id}`,
            );
          }
          const precioAntes = N(loteBase.precioCosto);

          const prevBase = await tx.stock.findMany({
            where: {
              productoId: loteBase.productoId,
              sucursalId: loteBase.sucursalId,
              id: { not: loteBase.id },
              cantidad: { gt: 0 },
            },
            select: { cantidad: true, precioCosto: true },
          });
          const prevPres = await tx.stockPresentacion.findMany({
            where: {
              productoId: loteBase.productoId,
              sucursalId: loteBase.sucursalId,
              cantidadPresentacion: { gt: 0 },
            },
            select: { cantidadPresentacion: true, precioCosto: true },
          });

          const existPrev =
            prevBase.reduce((s, r) => s + N(r.cantidad), 0) +
            prevPres.reduce((s, r) => s + N(r.cantidadPresentacion), 0);

          const invPrev =
            prevBase.reduce((s, r) => s + N(r.cantidad) * N(r.precioCosto), 0) +
            prevPres.reduce(
              (s, r) => s + N(r.cantidadPresentacion) * N(r.precioCosto),
              0,
            );

          const nuevasExist = existPrev + cantidad;
          const invAcum = invPrev + inversionLinea;
          const cpu = nuevasExist > 0 ? invAcum / nuevasExist : u;

          await tx.stock.update({
            where: { id: loteBase.id },
            data: { precioCosto: u },
          });

          await tx.prorrateoDetalle.create({
            data: {
              prorrateoId: pr.id,
              stockId: loteBase.id,

              cantidadBase: cantidad,
              valorBase: 0,
              montoAsignado,

              precioCostoAntes: precioAntes,
              precioCostoDesp: u,
              gastoUnitarioBase: a,
              costoFacturaUnitario: cFactura,
              gastoUnitarioAplicado: a,
              costoUnitarioResultante: u,
              inversionLinea,

              existenciasPrevias: existPrev,
              inversionPrevias: +invPrev.toFixed(4),
              nuevasExistencias: nuevasExist,
              costoProrrateadoTotalInversion: +invAcum.toFixed(4),
              costoUnitarioProrrateado: +cpu.toFixed(6),
            },
          });
        }
      }

      return pr;
    }

    // ==========================
    // MODO B: por LOTES NUEVOS
    // ==========================
    const baseIds = dto.newStockIds ?? [];
    const presIds = dto.newStocksPresIds ?? [];
    if (!baseIds.length && !presIds.length) {
      throw new Error(
        'Debes proporcionar compraRecepcionId o newStockIds/newStocksPresIds',
      );
    }

    // Traer lotes nuevos con datos suficientes
    const lotesBase = baseIds.length
      ? await tx.stock.findMany({
          where: { id: { in: baseIds } },
          select: {
            id: true,
            productoId: true,
            sucursalId: true,
            cantidadInicial: true,
            cantidad: true,
            precioCosto: true, // cᵢ
            costoTotal: true,
          },
        })
      : [];

    const lotesPres = presIds.length
      ? await tx.stockPresentacion.findMany({
          where: { id: { in: presIds } },
          select: {
            id: true,
            productoId: true,
            presentacionId: true,
            sucursalId: true,
            cantidadPresentacion: true,
            precioCosto: true, // cᵢ
            costoTotal: true,
          },
        })
      : [];

    // Normaliza cantidades (con fallback)
    const qtyBaseByLot = lotesBase.map((l) => {
      const q1 = N(l.cantidadInicial);
      const q2 = q1 > 0 ? q1 : N(l.cantidad);
      const q3 =
        q2 > 0 || !l.precioCosto
          ? q2
          : N((l.costoTotal ?? 0) / (l.precioCosto || 1));
      return {
        id: l.id,
        qty: q3,
        cFactura: N(l.precioCosto),
        productoId: l.productoId,
        sucursalId: l.sucursalId,
      };
    });

    const qtyPresByLot = lotesPres.map((l) => {
      const q1 = N(l.cantidadPresentacion);
      const q3 =
        q1 > 0 || !l.precioCosto
          ? q1
          : N((l.costoTotal ?? 0) / (l.precioCosto || 1));
      return {
        id: l.id,
        qty: q3,
        cFactura: N(l.precioCosto),
        productoId: l.productoId,
        sucursalId: l.sucursalId,
      };
    });

    const Tbase = qtyBaseByLot.reduce((s, x) => s + x.qty, 0);
    const Tpres = qtyPresByLot.reduce((s, x) => s + x.qty, 0);
    const T = Tbase + Tpres;
    this.logger.debug(`[PRORRATEO] Tbase=${Tbase} Tpres=${Tpres} T=${T}`);
    if (T <= 0)
      throw new Error('No hay unidades en los lotes nuevos para prorratear');

    const a = N(G) / T;

    // ===== Snapshots agrupados por producto (pool de la compra)
    const porProducto = new Map<
      number,
      { sucursalId: number; qtyNueva: number; invNueva: number }
    >();

    for (const l of qtyBaseByLot) {
      const u = l.cFactura + a; // u = cᵢ + a
      const inv = l.qty * u; // inversión de este lote
      const cur = porProducto.get(l.productoId) ?? {
        sucursalId: l.sucursalId,
        qtyNueva: 0,
        invNueva: 0,
      };
      cur.qtyNueva += l.qty;
      cur.invNueva += inv;
      porProducto.set(l.productoId, cur);
    }

    for (const l of qtyPresByLot) {
      const u = l.cFactura + a;
      const inv = l.qty * u;
      const cur = porProducto.get(l.productoId) ?? {
        sucursalId: l.sucursalId,
        qtyNueva: 0,
        invNueva: 0,
      };
      cur.qtyNueva += l.qty;
      cur.invNueva += inv;
      porProducto.set(l.productoId, cur);
    }

    // Consulta existencias previas por producto (excluye los lotes nuevos)
    const snapshotPorProducto = new Map<
      number,
      {
        existPrev: number;
        invPrev: number;
        nuevasExist: number;
        invAcum: number;
        cpu: number;
      }
    >();

    for (const [pid, cur] of porProducto) {
      const prevBase = await tx.stock.findMany({
        where: {
          productoId: pid,
          sucursalId: cur.sucursalId,
          id: { notIn: baseIds },
        },
        select: { cantidad: true, precioCosto: true },
      });
      const prevPres = await tx.stockPresentacion.findMany({
        where: {
          productoId: pid,
          sucursalId: cur.sucursalId,
          id: { notIn: presIds },
        },
        select: { cantidadPresentacion: true, precioCosto: true },
      });

      const existPrevBase = prevBase.reduce(
        (s, r) => s + Math.max(0, N(r.cantidad)),
        0,
      );
      const invPrevBase = prevBase.reduce(
        (s, r) => s + Math.max(0, N(r.cantidad)) * N(r.precioCosto),
        0,
      );
      const existPrevPres = prevPres.reduce(
        (s, r) => s + Math.max(0, N(r.cantidadPresentacion)),
        0,
      );
      const invPrevPres = prevPres.reduce(
        (s, r) => s + Math.max(0, N(r.cantidadPresentacion)) * N(r.precioCosto),
        0,
      );

      const existPrev = existPrevBase + existPrevPres;
      const invPrev = invPrevBase + invPrevPres;

      const nuevasExist = existPrev + cur.qtyNueva;
      const invAcum = invPrev + cur.invNueva;
      const cpu = nuevasExist > 0 ? invAcum / nuevasExist : 0;

      snapshotPorProducto.set(pid, {
        existPrev,
        invPrev: +invPrev.toFixed(4),
        nuevasExist,
        invAcum: +invAcum.toFixed(4),
        cpu: +cpu.toFixed(6),
      });
    }

    // Cabecera prorrateo
    const pr = await tx.prorrateo.create({
      data: {
        sucursalId: dto.sucursalId,
        metodo: 'UNIDADES',
        montoTotal: N(G),
        compraId: dto.compraId ?? null,
        compraRecepcionId: dto.compraRecepcionId ?? null,
        entregaStockId: dto.entregaStockId ?? null,
        movimientoFinancieroId: dto.movimientoFinancieroId ?? null,
        comentario: dto.comentario ?? null,
      },
    });

    // === Crear detalles BASE usando snapshot por producto
    for (const l of qtyBaseByLot) {
      if (l.qty <= 0) continue;
      const u = l.cFactura + a;
      const montoAsignado = l.qty * a;
      const inversionLinea = l.qty * u;

      const before = await tx.stock.findUnique({
        where: { id: l.id },
        select: { precioCosto: true },
      });
      await tx.stock.update({ where: { id: l.id }, data: { precioCosto: u } });

      const snap = snapshotPorProducto.get(l.productoId) ?? {
        existPrev: 0,
        invPrev: 0,
        nuevasExist: l.qty,
        invAcum: l.qty * u,
        cpu: u,
      };

      await tx.prorrateoDetalle.create({
        data: {
          prorrateoId: pr.id,
          stockId: l.id,
          stockPresentacionId: null,

          cantidadBase: l.qty,
          valorBase: 0,
          montoAsignado,
          precioCostoAntes: N(before?.precioCosto),
          precioCostoDesp: u,

          gastoUnitarioBase: a,
          costoFacturaUnitario: l.cFactura,
          gastoUnitarioAplicado: a,
          costoUnitarioResultante: u,
          inversionLinea,

          existenciasPrevias: snap.existPrev,
          inversionPrevias: snap.invPrev,
          nuevasExistencias: snap.nuevasExist,
          costoProrrateadoTotalInversion: snap.invAcum,
          costoUnitarioProrrateado: snap.cpu,
        },
      });
    }

    // === Crear detalles PRESENTACIÓN usando snapshot por producto
    for (const l of qtyPresByLot) {
      if (l.qty <= 0) continue;
      const u = l.cFactura + a;
      const montoAsignado = l.qty * a;
      const inversionLinea = l.qty * u;

      const before = await tx.stockPresentacion.findUnique({
        where: { id: l.id },
        select: { precioCosto: true, productoId: true },
      });
      await tx.stockPresentacion.update({
        where: { id: l.id },
        data: { precioCosto: u },
      });

      const pid =
        before?.productoId ??
        qtyPresByLot.find((q) => q.id === l.id)?.productoId!;
      const snap = snapshotPorProducto.get(pid) ?? {
        existPrev: 0,
        invPrev: 0,
        nuevasExist: l.qty,
        invAcum: l.qty * u,
        cpu: u,
      };

      await tx.prorrateoDetalle.create({
        data: {
          prorrateoId: pr.id,
          stockId: null,
          stockPresentacionId: l.id,

          cantidadBase: l.qty,
          valorBase: 0,
          montoAsignado,
          precioCostoAntes: N(before?.precioCosto),
          precioCostoDesp: u,

          gastoUnitarioBase: a,
          costoFacturaUnitario: l.cFactura,
          gastoUnitarioAplicado: a,
          costoUnitarioResultante: u,
          inversionLinea,

          existenciasPrevias: snap.existPrev,
          inversionPrevias: snap.invPrev,
          nuevasExistencias: snap.nuevasExist,
          costoProrrateadoTotalInversion: snap.invAcum,
          costoUnitarioProrrateado: snap.cpu,
        },
      });
    }

    return pr;
  }
}
