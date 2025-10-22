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
import { MetodoPago, Prisma } from '@prisma/client';
import { GetCreditoAutorizacionesDto } from './dto/get-credito-autorizaciones.dto';
import { normalizeSolicitud } from './common/normalizerAutorizacionesResponse';
import { LegacyGateway } from 'src/web-sockets/websocket.gateway';
import { AcceptCreditoDTO } from './dto/acept-credito-auth';
import { VentaService } from 'src/venta/venta.service';
import { CreateVentaDto } from 'src/venta/dto/create-venta.dto';
import { cuotasPropuestas } from './dto/simple-interfaces';
import { CreateAbonoCreditoDTO } from './dto/create-new-payment';
dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.locale('es');

interface ItemFromLineProduct {
  productoId: number;
  cantidad: number;
  subtotal: number;
  precioUnitario: number;
}

const sum = (arr: number[]) => arr.reduce((a, b) => a + (Number(b) || 0), 0);

@Injectable()
export class CreditoAutorizationService {
  private readonly logger = new Logger(CreditoAutorizationService.name);
  constructor(
    private readonly prisma: PrismaService,

    private readonly ws: LegacyGateway,
    private readonly venta: VentaService,
  ) {}
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
      const createdId = await this.prisma.$transaction(async (tx) => {
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

        return autorization.id;
      });

      const rec = await this.prisma.solicitudCreditoVenta.findUnique({
        where: {
          id: createdId,
        },
        select: selectCreditAutorization,
      });

      if (!rec) throw new Error('Re-fetch falló');
      const item = normalizeSolicitud(rec);
      this.ws.emitCreditAuthorizationCreated(item);
      // ===================== Respuesta final =====================
      this.logger.log(
        '[CreditoAutorizationService] Autorización creada OK (full):',
      );
      this.logger.log(JSON.stringify(createdId, null, 2));

      return createdId;
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
        precioSeleccionadoId: l.precioSeleccionadoId, //nuevo

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
      //nuevo
      precioSeleccionadoId: number;
    },
  ) {
    return tx.solicitudCreditoVentaLinea.create({
      data: {
        cantidad: l.cantidad,
        precioUnitario: l.precioUnitario,
        precioListaRef: l.precioListaRef,
        subtotal: l.subtotal,
        precioSeleccionado: {
          connect: {
            id: l.precioSeleccionadoId,
          },
        },
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

  //=====> CREAR CREDITO | ACEPTAR CRÉDITO (crea Venta, VentaCuota, cuotas y paga enganche si aplica)
  async createCredito(dto: AcceptCreditoDTO) {
    verifyProps<AcceptCreditoDTO>(dto, ['adminId', 'authCreditoId']);
    const {
      adminId,
      authCreditoId,
      cajaId,
      comentario,
      cuentaBancariaId,
      metodoPago,
    } = dto;

    return this.prisma.$transaction(async (tx) => {
      const authorization = await tx.solicitudCreditoVenta.findUnique({
        where: { id: authCreditoId },
        select: selectCreditAutorization,
      });
      if (!authorization)
        throw new BadRequestException('Autorización no encontrada');

      const admin = await tx.usuario.findUnique({
        where: { id: adminId },
        select: { id: true, sucursalId: true },
      });
      if (!admin) throw new BadRequestException('Admin no válido');

      // Venta (ideal: con tx)
      const productosDTO: CreateVentaDto['productos'] =
        authorization.lineas.map((l) => ({
          selectedPriceId: l.precioSeleccionadoId,
          cantidad: l.cantidad,
          ...(l.presentacionId ? { presentacionId: l.presentacionId } : {}),
          ...(l.productoId ? { productoId: l.productoId } : {}),
        }));
      const reffVenta = `CRED-${dayjs().year()}-${String(authCreditoId).padStart(5, '0')}`;
      const ventaDTO: CreateVentaDto = {
        metodoPago: metodoPago ?? 'EFECTIVO',
        sucursalId: admin.sucursalId,
        tipoComprobante: 'RECIBO',
        observaciones: comentario,
        usuarioId: adminId,
        // referenciaPago: reffVenta,
        clienteId: authorization.clienteId,
        productos: productosDTO,
      };

      // Si tu servicio Venta soporta tx:
      const newVenta = await this.venta.createVentaTx(ventaDTO, tx);

      //  Datos derivados de las cuotas propuestas
      const cuotasAuth = (authorization.cuotasPropuestas ??
        []) as cuotasPropuestas[];
      const montoTotalConInteres = sum(
        cuotasAuth.map((c) => Number(c.monto || 0)),
      );

      const primeraNormalDate =
        cuotasAuth
          .filter((c) => c.etiqueta === 'NORMAL' && c.fecha)
          .map((c) => c.fecha as Date)
          .sort((a, b) => +a - +b)[0] ?? null;

      const fechaInicio = authorization.fechaPrimeraCuota ?? undefined;

      const creditHeader = await tx.ventaCuota.create({
        data: {
          cliente: { connect: { id: newVenta.clienteId } },
          usuario: { connect: { id: adminId } },
          sucursal: { connect: { id: newVenta.sucursalId } },
          venta: { connect: { id: newVenta.id } },

          totalVenta: newVenta.totalVenta,
          montoVenta: authorization.totalPropuesto,
          cuotaInicial: authorization.cuotaInicialPropuesta ?? 0,
          cuotasTotales: authorization.cuotasTotalesPropuestas,
          estado: 'ACTIVA',
          fechaInicio,
          interes: authorization.interesPorcentaje ?? 0,
          interesTipo: authorization.interesTipo ?? 'NONE',
          diasEntrePagos: authorization.diasEntrePagos ?? 0,
          planCuotaModo: authorization.planCuotaModo ?? 'IGUALES',
          comentario: authorization.comentario ?? undefined,
          fechaContrato: new Date(),
          garantiaMeses: 0,
          testigos: [],
          fechaProximoPago: primeraNormalDate ?? undefined,
          montoTotalConInteres,
        },
      });

      // Validar si hay enganche
      const itHasEnganche =
        !!authorization.cuotaInicialPropuesta &&
        authorization.planCuotaModo === 'PRIMERA_MAYOR';

      if (itHasEnganche) {
        if (!metodoPago) {
          throw new BadRequestException(
            'Se requiere método de pago para registrar el enganche.',
          );
        }
        if (!cajaId && !cuentaBancariaId) {
          throw new BadRequestException(
            'Debe especificar cajaId o cuentaBancariaId para el enganche.',
          );
        }
      }

      await this.generateCuotasFromCredito(
        tx,
        cuotasAuth,
        creditHeader.id,
        {
          ventaCuotaId: creditHeader.id, // <- ¡Corregido!
          sucursalId: newVenta.sucursalId,
          usuarioId: adminId,
          metodoPago: metodoPago ?? 'EFECTIVO',
          montoTotal: authorization.cuotaInicialPropuesta ?? undefined, // se recalculará si hace falta
          detalles: [],
          // registroCajaId: ??? (si lo usas)
        },
        itHasEnganche,
      );

      await tx.ventaCuotaHistorial.create({
        data: {
          ventaCuotaId: creditHeader.id,
          accion: 'CREADO',
          comentario: 'Crédito aceptado desde autorización',
          usuarioId: adminId,
        },
      });

      await tx.solicitudCreditoVenta.update({
        where: {
          id: authorization.id,
        },
        data: {
          estado: 'APROBADO',
        },
      });
      return creditHeader;
    });
  }

  //CONTRUIR CUOTAS Y PAGAR LA PRIMERA, SI HUBO ENGANCHE
  // Construye cuotas y paga la primera si es enganche
  private async generateCuotasFromCredito(
    tx: Prisma.TransactionClient,
    cuotas: cuotasPropuestas[],
    creditoId: number,
    abonoBaseDto: CreateAbonoCreditoDTO,
    itHasEnganche: boolean,
  ) {
    if (!cuotas?.length) {
      throw new InternalServerErrorException('Cuotas de autorización vacías.');
    }

    // Separar enganche y normales
    const enganche = cuotas.find((c) => c.etiqueta === 'ENGANCHE') || null;
    const normales = cuotas.filter((c) => c.etiqueta === 'NORMAL');

    let nextNumero = 1;

    // 1) Si hay enganche, crear cuota #1 y pagarla
    if (itHasEnganche && enganche) {
      const cuotaEnganche = await tx.cuota.create({
        data: {
          ventaCuotaId: creditoId,
          numero: nextNumero,
          monto: Number(enganche.monto || 0),
          montoEsperado: Number(enganche.monto || 0),
          // montoCapital: enganche.capital ?? null,
          // montoInteres: enganche.interes ?? null,
          estado: 'PENDIENTE', // se actualizará a PAGADA tras abono
          fechaVencimiento: enganche.fecha ?? new Date(),
        },
      });

      // Armar dto de pago usando el id real de la cuota enganche
      const pagoEngancheDto: CreateAbonoCreditoDTO = {
        ...abonoBaseDto,
        ventaCuotaId: creditoId,
        detalles: [
          {
            cuotaId: cuotaEnganche.id,
            // montoCapital: enganche.capital ?? Number(enganche.monto || 0),
            // montoInteres: enganche.interes ?? 0,
            montoMora: 0,
            // montoTotal:1
          },
        ],
        // montoTotal total del abono (si no vino, lo calculamos)
        montoTotal: abonoBaseDto.montoTotal,
        // ((enganche.capital ?? 0) + (enganche.interes ?? 0)),
      };

      await this.payCuota(pagoEngancheDto, tx); // reusa lógica de pago dentro del mismo tx
      nextNumero++;
    }

    // 2) Crear cuotas normales con numeración consecutiva
    if (normales.length) {
      await Promise.all(
        normales.map((c, i) =>
          tx.cuota.create({
            data: {
              ventaCuotaId: creditoId,
              numero: nextNumero + i,
              monto: Number(c.monto || 0),
              montoEsperado: Number(c.monto || 0),
              // montoCapital: c.capital ?? null,
              // montoInteres: c.interes ?? null,
              estado: 'PENDIENTE',
              fechaVencimiento: c.fecha ?? null,
            },
          }),
        ),
      );
    }
  }

  //MATAR UNA CUOTA =======>
  // API pública: puede recibir tx opcional
  async payCuota(dto: CreateAbonoCreditoDTO, tx?: Prisma.TransactionClient) {
    if (tx) return this._payCuotaWithClient(dto, tx);
    return this.prisma.$transaction(async (t) =>
      this._payCuotaWithClient(dto, t),
    );
  }

  private async _payCuotaWithClient(
    dto: CreateAbonoCreditoDTO,
    tx: Prisma.TransactionClient,
  ) {
    const {
      detalles,
      metodoPago,
      sucursalId,
      usuarioId,
      ventaCuotaId,
      fechaAbono,
      referenciaPago,
    } = dto;

    if (!detalles?.length) {
      throw new BadRequestException(
        'Debe proporcionar al menos un detalle de cuota a abonar.',
      );
    }

    const detallesReady = detalles.map((d) => {
      const total =
        d.montoTotal ??
        (d.montoCapital ?? 0) + (d.montoInteres ?? 0) + (d.montoMora ?? 0);
      return { ...d, montoTotal: total };
    });
    const totalAbono =
      dto.montoTotal ?? sum(detallesReady.map((d) => d.montoTotal!));

    //Crear AbonoCredito cabecera
    const abono = await tx.abonoCredito.create({
      data: {
        ventaCuotaId,
        sucursalId,
        usuarioId,
        metodoPago,
        referenciaPago: referenciaPago ?? '',
        fechaAbono: fechaAbono ?? new Date(),
        montoTotal: totalAbono,
        detalles: {
          create: detallesReady.map((d) => ({
            cuotaId: d.cuotaId,
            montoCapital: d.montoCapital ?? 0,
            montoInteres: d.montoInteres ?? 0,
            montoMora: d.montoMora ?? 0,
            montoTotal: d.montoTotal!,
          })),
        },
      },
      include: { detalles: true },
    });

    const reff = `ABO-${new Date().getFullYear()}-${abono.id}`;
    await tx.abonoCredito.update({
      where: { id: abono.id },
      data: { referenciaPago: reff },
    });

    //  Actualizar cada cuota montoPagado + estado
    for (const det of abono.detalles) {
      const prev = await tx.cuota.findUnique({
        where: { id: det.cuotaId },
        select: { id: true, monto: true, montoPagado: true },
      });
      if (!prev) continue;

      const nuevoPagado =
        Number(prev.montoPagado || 0) + Number(det.montoTotal || 0);
      const pagada = nuevoPagado + 1e-6 >= Number(prev.monto);

      await tx.cuota.update({
        where: { id: prev.id },
        data: {
          montoPagado: nuevoPagado,
          estado: pagada ? 'PAGADA' : 'PARCIAL',
          fechaPago: pagada ? new Date() : undefined,
        },
      });
    }

    //Actualizar totales de la cabecera del crédito
    await tx.ventaCuota.update({
      where: { id: ventaCuotaId },
      data: { totalPagado: { increment: totalAbono } },
    });

    //  Historial
    await tx.ventaCuotaHistorial.create({
      data: {
        ventaCuotaId,
        accion: 'ABONO',
        comentario: `Abono registrado: ${totalAbono}`,
        usuarioId,
      },
    });

    return { ...abono, referenciaPago: reff };
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

      this.logger.log(
        `El where construido:\n${JSON.stringify(where, null, 2)}`,
      );
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
      await this.prisma.ventaCuota.deleteMany({});
      return this.prisma.solicitudCreditoVenta.deleteMany({});
    } catch (error) {}
  }
}
