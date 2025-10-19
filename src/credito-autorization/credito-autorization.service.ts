import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CreateCreditoAutorizationDto,
  CuotaPropuestaDto,
} from './dto/create-credito-autorization.dto';
import { UpdateCreditoAutorizationDto } from './dto/update-credito-autorization.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { verifyProps } from 'src/utils/verifyPropsFromDTO';

import * as dayjs from 'dayjs';
import 'dayjs/locale/es';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';
import * as isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import * as isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import * as customParseFormat from 'dayjs/plugin/customParseFormat';
import { TZGT } from 'src/utils/utils';
import { selectCreditAutorization } from './helpers/select';
import { Prisma } from '@prisma/client';
import { GetCreditoAutorizacionesDto } from './dto/get-credito-autorizaciones.dto';
import { normalizeSolicitud } from './common/normalizerAutorizacionesResponse';
dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.locale('es');

@Injectable()
export class CreditoAutorizationService {
  private readonly logger = new Logger(CreditoAutorizationService.name);
  constructor(private readonly prisma: PrismaService) {}
  /**
   * CREACION DE REGISTRO DE AUTORIZACION 1er PASO
   * @param dto Datos primarios para persistir el credito en la autorizacion
   * @returns Crea la autorización con sus líneas + historial + cuotas propuestas
   */
  async create(dto: CreateCreditoAutorizationDto) {
    try {
      this.logger.log(
        `DTO recibido en create autorizacion:\n${JSON.stringify(dto, null, 2)}`,
      );

      // ===================== Validaciones/normalizaciones previas =====================
      this.verifyCore(dto);

      const saneLines = this.sanitizeAndValidateLines(dto.lineas);

      // Sumar totales desde servidor (no confiar 100% en cliente)
      const serverSum = this.sumLineSubtotals(saneLines);
      if (serverSum !== dto.totalPropuesto) {
        this.logger.warn(
          `[CreditoAutorizationService] totalPropuesto del cliente (${dto.totalPropuesto}) difiere del calculado en servidor (${serverSum}). Se usará el del servidor.`,
        );
      }

      // Cuota inicial coherente con plan (se sobreescribe si viene en cuotasPropuestas)
      const cuotaInicialByPlan = this.resolveEnganche(
        dto.planCuotaModo,
        dto.cuotaInicialPropuesta,
      );

      // Primera cuota
      const today = dayjs().tz(TZGT);
      const primeraCuotaDate = dto.fechaPrimeraCuota
        ? dayjs(dto.fechaPrimeraCuota).toDate()
        : today.toDate();

      // ====== NUEVO: validar/normalizar cuotas propuestas ======
      const cuotas = this.sanitizeCuotasPropuestas(dto.cuotasPropuestas);

      // Suma de cuotas propuesta (incluyendo enganche si existe)
      const sumaCuotas = cuotas.reduce((acc, c) => acc + c.monto, 0);

      // Si la cuotaInicial en cabecera difiere del ENGANCHE de cuotas, usamos el de cuotas
      const enganchePropuesto =
        cuotas.find((c) => c.etiqueta === 'ENGANCHE')?.monto ?? 0;
      if (
        dto.cuotaInicialPropuesta &&
        Math.abs(dto.cuotaInicialPropuesta - enganchePropuesto) > 0.01
      ) {
        this.logger.warn(
          `Enganche en cabecera (${dto.cuotaInicialPropuesta}) difiere del de cuotas (${enganchePropuesto}). Se usará el de cuotas.`,
        );
      }
      const cuotaInicialFinal = enganchePropuesto || cuotaInicialByPlan;

      // ===================== Transacción =====================
      const result = await this.prisma.$transaction(async (tx) => {
        // ---- Cabecera
        const autorization = await tx.solicitudCreditoVenta.create({
          data: {
            cliente: { connect: { id: dto.clienteId } },
            solicitadoPor: { connect: { id: dto.solicitadoPorId } },
            sucursal: { connect: { id: dto.sucursalId } },

            // Propuesta económica
            totalPropuesto: serverSum, // principal (suma lineas servidor)
            cuotaInicialPropuesta: cuotaInicialFinal, // ENGANCHE (de cuotas o por plan)
            cuotasTotalesPropuestas: dto.cuotasTotalesPropuestas,
            interesTipo: dto.interesTipo,
            interesPorcentaje: dto.interesPorcentaje,
            planCuotaModo: dto.planCuotaModo,
            diasEntrePagos: dto.diasEntrePagos,
            fechaPrimeraCuota: primeraCuotaDate,

            // Flujo
            comentario: dto.comentario || null,
            estado: 'PENDIENTE',

            // Si quieres guardar la suma de cuotas con interés (opcional):
            // montoTotalConInteres: sumaCuotas,
          },
        });

        this.logger.log(
          '[CreditoAutorizationService] Cabecera creada:',
          autorization,
        );

        // ---- Líneas
        const createdLines = await Promise.all(
          saneLines.map((l) => this.createLinea(tx, autorization.id, l)),
        );
        this.logger.log(
          '[CreditoAutorizationService] Líneas creadas:',
          createdLines,
        );

        // ---- NUEVO: Cuotas propuestas
        const createdCuotas = await Promise.all(
          cuotas.map((c) =>
            tx.solicitudCreditoVentaCuota.create({
              data: {
                solicitud: { connect: { id: autorization.id } },
                numero: c.numero,
                fecha: c.fecha, // Date
                monto: c.monto,
                etiqueta: c.etiqueta as any, // 'ENGANCHE' | 'NORMAL'
                origen: c.origen as any, // 'AUTO' | 'MANUAL'
                esManual: c.esManual,
                montoCapital: c.montoCapital ?? null,
                montoInteres: c.montoInteres ?? null,
              },
            }),
          ),
        );
        this.logger.log(
          `[CreditoAutorizationService] Cuotas propuestas creadas (${createdCuotas.length}):`,
          createdCuotas,
        );

        // ---- Historial
        const historial = await tx.solicitudCreditoVentaHistorial.create({
          data: {
            solicitud: { connect: { id: autorization.id } },
            accion: 'CREADA',
            comentario: dto.comentario || null,
            actor: dto.solicitadoPorId
              ? { connect: { id: dto.solicitadoPorId } }
              : undefined,
          },
        });
        this.logger.log(
          '[CreditoAutorizationService] Historial creado:',
          historial,
        );

        // ---- Retornar entidad con relaciones (incluye cuotasPropuestas)
        const full = await tx.solicitudCreditoVenta.findUnique({
          where: { id: autorization.id },
          include: {
            lineas: true,
            cuotasPropuestas: { orderBy: { numero: 'asc' } }, // <— NUEVO
            historial: { orderBy: { fecha: 'desc' } },
            cliente: true,
            sucursal: true,
            solicitadoPor: true,
            aprobadoPor: true,
          },
        });

        return full;
      });

      // ===================== Respuesta final =====================
      this.logger.log(
        '[CreditoAutorizationService] Autorización creada OK (full):',
      );
      this.logger.log(JSON.stringify(result, null, 2));

      return result;
    } catch (error) {
      this.logger.error(
        'Error en modulo crear autorizacion: ',
        error?.stack || error,
      );
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'Fatal error: Error inesperado en módulo autorizacion',
      );
    }
  }

  /**
   * Valida y normaliza cuotas propuestas del DTO.
   * Reglas: numero entero >=0 (0 reservado para ENGANCHE), fecha ISO válida,
   * monto >= 0, sin números repetidos, orden ascendente por numero.
   */
  private sanitizeCuotasPropuestas(
    items: Array<{
      numero: number;
      fechaISO: string;
      monto: number;
      etiqueta?: 'ENGANCHE' | 'NORMAL';
      origen?: 'AUTO' | 'MANUAL';
      esManual?: boolean;
      montoCapital?: number;
      montoInteres?: number;
    }>,
  ) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException(
        'Debe enviar al menos una cuota propuesta.',
      );
    }

    const byNumero = new Set<number>();
    const cuotas = items.map((c, idx) => {
      const numero = Number(c.numero);
      if (!Number.isInteger(numero) || numero < 0) {
        throw new BadRequestException(`Cuota ${idx + 1}: numero inválido.`);
      }
      if (byNumero.has(numero)) {
        throw new BadRequestException(`Cuota repetida: numero=${numero}`);
      }
      byNumero.add(numero);

      const monto = Number(c.monto);
      if (!Number.isFinite(monto) || monto < 0) {
        throw new BadRequestException(`Cuota ${idx + 1}: monto inválido.`);
      }

      const fecha = dayjs(c.fechaISO).isValid()
        ? dayjs(c.fechaISO).toDate()
        : null;
      if (!fecha)
        throw new BadRequestException(`Cuota ${idx + 1}: fecha inválida.`);

      const etiqueta: 'ENGANCHE' | 'NORMAL' =
        c.etiqueta === 'ENGANCHE' ? 'ENGANCHE' : 'NORMAL';
      const origen: 'AUTO' | 'MANUAL' =
        c.origen === 'MANUAL' ? 'MANUAL' : 'AUTO';
      const esManual = !!c.esManual;

      return {
        numero,
        fecha,
        monto,
        etiqueta,
        origen,
        esManual,
        montoCapital: Number.isFinite(c.montoCapital as any)
          ? c.montoCapital!
          : null,
        montoInteres: Number.isFinite(c.montoInteres as any)
          ? c.montoInteres!
          : null,
      };
    });

    // Si hay enganche, validar que sea numero 0
    const eng = cuotas.find((q) => q.etiqueta === 'ENGANCHE');
    if (eng && eng.numero !== 0) {
      throw new BadRequestException(
        'La cuota de ENGANCHE debe tener numero=0.',
      );
    }

    cuotas.sort((a, b) => a.numero - b.numero);
    return cuotas;
  }

  /**
   * Verifica props core del caso de uso.
   * Usaremos clientes ya existentes; NO se permite crear snapshot de cliente aquí.
   */
  private verifyCore(dto: CreateCreditoAutorizationDto) {
    verifyProps<CreateCreditoAutorizationDto>(dto, [
      'sucursalId',
      'solicitadoPorId',
    ]);

    if (!dto.clienteId) {
      throw new BadRequestException(
        'clienteId es requerido (cliente preexistente).',
      );
    }
    if (!Array.isArray(dto.lineas) || dto.lineas.length === 0) {
      throw new BadRequestException(
        'Debe enviar al menos una línea de autorización.',
      );
    }
    if (!dto.cuotasTotalesPropuestas || dto.cuotasTotalesPropuestas < 1) {
      throw new BadRequestException('cuotasTotalesPropuestas debe ser >= 1.');
    }
    if (dto.diasEntrePagos <= 0) {
      throw new BadRequestException('diasEntrePagos debe ser > 0.');
    }
    if (!['NONE', 'SIMPLE', 'COMPUESTO'].includes(dto.interesTipo as any)) {
      throw new BadRequestException('interesTipo no válido.');
    }
    if (
      !['IGUALES', 'PRIMERA_MAYOR', 'CRECIENTES', 'DECRECIENTES'].includes(
        dto.planCuotaModo as any,
      )
    ) {
      throw new BadRequestException('planCuotaModo no válido.');
    }
    if (
      dto.planCuotaModo === 'PRIMERA_MAYOR' &&
      (!dto.cuotaInicialPropuesta || dto.cuotaInicialPropuesta <= 0)
    ) {
      throw new BadRequestException(
        'Para PRIMERA_MAYOR se requiere cuotaInicialPropuesta > 0.',
      );
    }
  }

  /**
   * Normaliza y valida cada línea: XOR producto/presentación; montos y cantidades válidas;
   * calcula subtotales si no vienen (seguridad servidor).
   */
  private sanitizeAndValidateLines(
    lineas: CreateCreditoAutorizationDto['lineas'],
  ) {
    const sane = lineas.map((l, idx) => {
      const hasProducto = typeof l.productoId === 'number';
      const hasPresentacion = typeof l.presentacionId === 'number';

      if (!hasProducto && !hasPresentacion) {
        throw new BadRequestException(
          `Línea ${idx + 1}: requiere productoId o presentacionId.`,
        );
      }
      if (hasProducto && hasPresentacion) {
        throw new BadRequestException(
          `Línea ${idx + 1}: no puede tener productoId y presentacionId al mismo tiempo.`,
        );
      }
      if (!Number.isFinite(l.cantidad) || l.cantidad <= 0) {
        throw new BadRequestException(`Línea ${idx + 1}: cantidad inválida.`);
      }
      if (!Number.isFinite(l.precioUnitario) || l.precioUnitario < 0) {
        throw new BadRequestException(
          `Línea ${idx + 1}: precioUnitario inválido.`,
        );
      }
      if (!Number.isFinite(l.precioListaRef) || l.precioListaRef < 0) {
        // Fallback: si no te mandan precio de lista, usa cantidad*precioUnitario solo para cumplir DTO;
        // si manejas catálogos de lista, reemplázalo aquí.
        l.precioListaRef = l.cantidad * l.precioUnitario;
      }
      if (!Number.isFinite(l.subtotal) || l.subtotal < 0) {
        l.subtotal = l.cantidad * l.precioUnitario; // servidor recalcula
      }

      return {
        productoId: hasProducto ? l.productoId! : undefined,
        presentacionId: hasPresentacion ? l.presentacionId! : undefined,
        cantidad: Math.trunc(l.cantidad),
        precioUnitario: l.precioUnitario,
        precioListaRef: l.precioListaRef,
        subtotal: l.subtotal,
      };
    });

    return sane;
  }

  /** Suma de subtotales calculados en servidor. */
  private sumLineSubtotals(lines: Array<{ subtotal: number }>) {
    return lines.reduce((acc, l) => acc + Number(l.subtotal || 0), 0);
  }

  /** Reglas para enganche según plan. */
  private resolveEnganche(plan: string, fromDto?: number) {
    if (plan === 'PRIMERA_MAYOR') {
      const v = Number(fromDto || 0);
      if (!Number.isFinite(v) || v <= 0) {
        throw new BadRequestException(
          'cuotaInicialPropuesta inválida para PRIMERA_MAYOR.',
        );
      }
      return v;
    }
    // Para otros planes, enganche 0
    return 0;
  }

  /**
   * Creador de línea (aislado para Promise.all), incluye XOR connect.
   * Retorna la línea creada (útil para log y respuesta).
   */
  private createLinea(
    tx: Prisma.TransactionClient,
    solicitudId: number,
    l: {
      productoId?: number;
      presentacionId?: number;
      cantidad: number;
      precioUnitario: number;
      precioListaRef: number;
      subtotal: number;
    },
  ) {
    return tx.solicitudCreditoVentaLinea.create({
      data: {
        cantidad: l.cantidad,
        precioUnitario: l.precioUnitario,
        precioListaRef: l.precioListaRef,
        subtotal: l.subtotal,
        solicitud: { connect: { id: solicitudId } },
        ...(l.productoId
          ? { producto: { connect: { id: l.productoId } } }
          : {}),
        ...(l.presentacionId
          ? { presentacion: { connect: { id: l.presentacionId } } }
          : {}),
      },
    });
  }

  //GET==========>
  private sanitizePagination(page?: number, limit?: number) {
    const p = Math.max(1, Number(page || 1));
    const l = Math.min(100, Math.max(1, Number(limit || 10)));
    const skip = (p - 1) * l;
    return { page: p, limit: l, skip, take: l };
  }

  private buildWhere(
    qry: GetCreditoAutorizacionesDto,
  ): Prisma.SolicitudCreditoVentaWhereInput {
    const and: Prisma.SolicitudCreditoVentaWhereInput[] = [];

    if (qry.estado) and.push({ estado: qry.estado });
    if (qry.sucursalId) and.push({ sucursalId: Number(qry.sucursalId) });
    if (qry.clienteId) and.push({ clienteId: Number(qry.clienteId) });

    if (qry.fechaDesde || qry.fechaHasta) {
      const gte = qry.fechaDesde ? new Date(qry.fechaDesde) : undefined;
      const lte = qry.fechaHasta ? new Date(qry.fechaHasta) : undefined;
      and.push({ fechaSolicitud: { gte, lte } });
    }

    if (qry.q && qry.q.trim().length > 0) {
      const q = qry.q.trim();
      and.push({
        OR: [
          { comentario: { contains: q, mode: 'insensitive' } },
          { cliente: { nombre: { contains: q, mode: 'insensitive' } } },
          { cliente: { apellidos: { contains: q, mode: 'insensitive' } } },
          {
            lineas: {
              some: {
                producto: { nombre: { contains: q, mode: 'insensitive' } },
              },
            },
          },
          {
            lineas: {
              some: {
                presentacion: { nombre: { contains: q, mode: 'insensitive' } },
              },
            },
          },
        ],
      });
    }

    return and.length ? { AND: and } : {};
  }

  private buildOrderBy(
    sortBy?: string,
    sortDir?: 'asc' | 'desc',
  ): Prisma.SolicitudCreditoVentaOrderByWithRelationInput {
    const dir = sortDir || 'desc';
    switch (sortBy) {
      case 'creadoEn':
        return { creadoEn: dir };
      case 'actualizadoEn':
        return { actualizadoEn: dir };
      case 'totalPropuesto':
        return { totalPropuesto: dir };
      case 'estado':
        return { estado: dir };
      case 'fechaSolicitud':
      default:
        return { fechaSolicitud: dir };
    }
  }

  async getAutorizaciones(query: GetCreditoAutorizacionesDto) {
    try {
      const { page, limit, skip, take } = this.sanitizePagination(
        query.page,
        query.limit,
      );
      const where = this.buildWhere(query);
      const orderBy = this.buildOrderBy(query.sortBy, query.sortDir);

      const [total, records] = await this.prisma.$transaction([
        this.prisma.solicitudCreditoVenta.count({ where }),
        this.prisma.solicitudCreditoVenta.findMany({
          select: selectCreditAutorization, // <-- ahora incluye cuotasPropuestas
          where,
          orderBy,
          skip,
          take,
        }),
      ]);

      const data = records.map(normalizeSolicitud); // <-- normaliza schedule.cuotas & métricas
      const pages = Math.max(1, Math.ceil(total / limit));

      this.logger.log(
        `[CreditoAutorizationService] GET autorizaciones -> total=${total} page=${page}/${pages} items=${records.length}`,
      );

      return {
        meta: {
          total,
          page,
          pages,
          limit,
          sortBy: query.sortBy || 'fechaSolicitud',
          sortDir: query.sortDir || 'desc',
          filters: {
            estado: query.estado ?? null,
            sucursalId: query.sucursalId ?? null,
            clienteId: query.clienteId ?? null,
            q: query.q ?? null,
            fechaDesde: query.fechaDesde ?? null,
            fechaHasta: query.fechaHasta ?? null,
          },
        },
        data,
      };
    } catch (error) {
      this.logger.error(
        'Error en módulo GET autorizaciones: ',
        error?.stack || error,
      );
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'Fatal error: Error inesperado en módulo autorizacion',
      );
    }
  }

  //DELTE PRUEBAS
  async deleteAll() {
    try {
      return this.prisma.solicitudCreditoVenta.deleteMany({});
    } catch (error) {}
  }
}
