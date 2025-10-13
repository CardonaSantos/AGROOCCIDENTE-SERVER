import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { CreateComprasPagoDto } from './dto/create-compras-pago.dto';
import { UpdateComprasPagoDto } from './dto/update-compras-pago.dto';
import { PrismaService } from 'src/prisma/prisma.service';

import * as dayjs from 'dayjs';
import 'dayjs/locale/es';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';
import * as isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import * as isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import * as customParseFormat from 'dayjs/plugin/customParseFormat';
import { TZGT } from 'src/utils/utils';
import { MovimientoFinancieroService } from 'src/movimiento-financiero/movimiento-financiero.service';
import { CxPCuota, Prisma } from '@prisma/client';
import { RegistroCaja } from '@prisma/client';
import { DeletePagoCuota } from './dto/delete-pago-cuota';
import { verifyProps } from 'src/utils/verifyPropsFromDTO';
dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.locale('es');

@Injectable()
export class ComprasPagosService {
  private readonly logger = new Logger(ComprasPagosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mf: MovimientoFinancieroService,
  ) {}

  /**
   * Crea y mata el registro de pago de una cuota
   * @param dto Datos basicos para pagar y decidir que deltas usar para caja o banco
   * @returns Registro de pago a una cuota
   */
  async create(dto: CreateComprasPagoDto) {
    this.logger.log(`DTO recibido:\n${JSON.stringify(dto, null, 2)}`);

    try {
      // Requeridos mínimos (fechaPago es opcional en tu DTO)
      verifyProps(dto, [
        'documentoId',
        'sucursalId',
        'cuotaId',
        'registradoPorId',
        'metodoPago',
        'monto',
      ]);

      const {
        documentoId,
        sucursalId,
        cuotaId,
        registradoPorId,
        metodoPago,
        monto,
        fechaPago,
        observaciones,
        referencia,
        expectedCuotaSaldo,
        comprobanteTipo,
        comprobanteNumero,
        comprobanteFecha,
        comprobanteUrl,
      } = dto;

      // Normalizar/validar monto como Decimal(14,2)
      const { Prisma } = await import('@prisma/client');
      const montoDec = new Prisma.Decimal(monto);
      if (montoDec.lte(0)) {
        throw new BadRequestException('El monto debe ser mayor a 0.');
      }

      // Normalizar método por si UI envía "CONTADO" algún día
      const metodo = (String(metodoPago) as any).toUpperCase();
      const metodoNorm: typeof metodoPago =
        metodo === 'CONTADO' ? ('EFECTIVO' as any) : metodoPago;

      // Fecha de pago (si no viene, usar now() GT)
      const fechaPagoDate = fechaPago
        ? new Date(fechaPago)
        : dayjs().tz(TZGT).toDate();

      // Transacción fuerte
      const result = await this.prisma.$transaction(
        async (tx) => {
          // 1) Documento (y proveedor para MF)
          const doc = await tx.cxPDocumento.findUnique({
            where: { id: documentoId },
            select: {
              id: true,
              proveedorId: true,
              estado: true,
            },
          });
          if (!doc) throw new BadRequestException('Documento no encontrado.');
          if (doc.estado === 'ANULADO') {
            throw new BadRequestException(
              'No se puede pagar un documento ANULADO.',
            );
          }

          // 2) Lock de la cuota y lectura consistente
          await tx.$executeRaw`SET LOCAL lock_timeout = '3s'`;
          await tx.$queryRaw`
          SELECT id FROM "CxPCuota"
          WHERE id = ${cuotaId}
          FOR UPDATE NOWAIT
        `;

          const cuota = await tx.cxPCuota.findUnique({
            where: { id: cuotaId },
            select: {
              id: true,
              documentoId: true,
              estado: true,
              saldo: true,
              monto: true,
            },
          });
          if (!cuota) throw new BadRequestException('Cuota no encontrada.');
          if (cuota.documentoId !== documentoId) {
            throw new BadRequestException(
              'La cuota no pertenece al documento.',
            );
          }
          if (cuota.estado === 'PAGADA') {
            throw new BadRequestException('La cuota ya está PAGADA.');
          }

          // 3) Concurrencia optimista (opcional)
          if (expectedCuotaSaldo != null) {
            const expected = new Prisma.Decimal(expectedCuotaSaldo);
            if (!expected.eq(cuota.saldo)) {
              throw new BadRequestException(
                `El saldo de la cuota cambió. Esperado ${expected.toFixed(
                  2,
                )}, actual ${new Prisma.Decimal(cuota.saldo).toFixed(2)}.`,
              );
            }
          }

          // 4) Validar capacidad de pago
          const saldoActual = new Prisma.Decimal(
            cuota.saldo ?? cuota.monto ?? 0,
          );
          if (montoDec.gt(saldoActual)) {
            throw new BadRequestException(
              `Monto (${montoDec.toFixed(
                2,
              )}) excede el saldo de la cuota (${saldoActual.toFixed(2)}).`,
            );
          }

          // 5) Crear MovimientoFinanciero (server decide Caja/Banco)
          // Por ahora, política conservadora:
          // - EFECTIVO => CAJA (DEPOSITO_PROVEEDOR)
          // - Otros métodos => TODO BANCO (requiere cuentaBancariaId en DTO)
          let movimiento: { id: number } | null = null;

          if (metodoNorm === ('EFECTIVO' as any)) {
            movimiento = await this.mf.createMovimiento(
              {
                sucursalId,
                usuarioId: registradoPorId,
                proveedorId: doc.proveedorId ?? undefined,
                motivo: 'DEPOSITO_PROVEEDOR', // egreso de caja al proveedor
                metodoPago: 'EFECTIVO',
                monto: Number(montoDec.toString()), // tu util usa number
                descripcion: observaciones ?? undefined,
                referencia: referencia ?? undefined,
                esDepositoProveedor: true,
                // registroCajaId: opcional; tu util lo resuelve si falta
              },
              { tx }, // MUY IMPORTANTE: dentro de la misma transacción
            );
          } else {
            // TODO: BANCO — cuando agregues cuentaBancariaId al DTO, habilita:
            movimiento = await this.mf.createMovimiento(
              {
                sucursalId,
                usuarioId: registradoPorId,
                proveedorId: doc.proveedorId ?? undefined,
                motivo: 'PAGO_PROVEEDOR_BANCO',
                metodoPago: metodoNorm as any,
                monto: Number(montoDec.toString()),
                descripcion: observaciones ?? undefined,
                referencia: referencia ?? undefined,
                cuentaBancariaId: dto.cuentaBancariaId, // <-- futuro
                // Puedes mapear comprobante* aquí si tu util los soporta
              },
              { tx },
            );
          }

          // 6) Crear CxPPago
          const pago = await tx.cxPPago.create({
            data: {
              documentoId,
              registradoPorId,
              metodoPago: metodoNorm,
              monto: montoDec, // Prisma soporta string|Decimal
              fechaPago: fechaPagoDate,
              referencia: referencia ?? null,
              observaciones: observaciones ?? null,
              movimientoFinancieroId: movimiento?.id ?? null, // enlace 1–1
            },
            select: {
              id: true,
              documentoId: true,
              metodoPago: true,
              monto: true,
              fechaPago: true,
              referencia: true,
              observaciones: true,
              movimientoFinancieroId: true,
            },
          });

          // 7) Crear distribución CxPPagoCuota (una sola cuota)
          await tx.cxPPagoCuota.create({
            data: {
              pagoId: pago.id,
              cuotaId: cuota.id,
              monto: montoDec,
            },
          });

          // 8) Actualizar cuota (saldo, estado, pagadaEn)
          const nuevoSaldo = saldoActual.minus(montoDec).toDecimalPlaces(2);
          const estadoCuota = nuevoSaldo.lte(0)
            ? ('PAGADA' as const)
            : ('PARCIAL' as const);

          const cuotaActualizada = await tx.cxPCuota.update({
            where: { id: cuota.id },
            data: {
              saldo: nuevoSaldo,
              estado: estadoCuota,
              pagadaEn: estadoCuota === 'PAGADA' ? fechaPagoDate : null,
            },
            select: {
              id: true,
              estado: true,
              saldo: true,
              pagadaEn: true,
            },
          });

          // 9) Recalcular saldoPendiente del documento y estado
          const agg = await tx.cxPCuota.aggregate({
            where: { documentoId },
            _sum: { saldo: true },
          });
          const saldoDoc = new Prisma.Decimal(
            agg._sum.saldo ?? 0,
          ).toDecimalPlaces(2);
          const estadoDoc = saldoDoc.eq(0)
            ? ('PAGADO' as const)
            : ('PARCIAL' as const);

          const docActualizado = await tx.cxPDocumento.update({
            where: { id: documentoId },
            data: {
              saldoPendiente: saldoDoc,
              estado: estadoDoc,
              // Si quieres updatedAt automático ya lo maneja @updatedAt
            },
            select: {
              id: true,
              estado: true,
              saldoPendiente: true,
            },
          });

          // 10) (Opcional) persistir comprobante en algún lado si tu esquema lo soporta
          // - Por ahora, lo dejamos como metadata en movimiento/pago vía `referencia` y `observaciones`.
          // - Si más adelante añades tabla de comprobantes, se inserta aquí.

          return {
            pago,
            cuotaActualizada,
            documentoActualizado: docActualizado,
            movimiento: movimiento ? { id: movimiento.id } : null,
          };
        },
        { isolationLevel: 'Serializable' },
      );

      return result;
    } catch (error) {
      this.logger.error(
        'Error en modulo de pagos credito compras',
        error?.stack,
      );
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'Fatal error: Error inesperado en modulo pago de creditos compras',
      );
    }
  }

  async deletePagoCuota(dto: DeletePagoCuota) {
    try {
      const { cuotaId, documentoId, usuarioId } = dto;
      this.logger.log(`DTO recibido:\n${JSON.stringify(dto, null, 2)}`);

      verifyProps<DeletePagoCuota>(dto, [
        'cuotaId',
        'documentoId',
        'usuarioId',
      ]);

      const deletedCuota = await this.prisma.$transaction(async (tx) => {
        const doc = await tx.cxPDocumento.findUnique({
          where: {
            id: documentoId,
          },
        });

        const cuota = await tx.cxPCuota.findUnique({
          where: {
            id: cuotaId,
          },
        });

        const user = await tx.usuario.findUnique({
          where: {
            id: usuarioId,
          },
        });

        if (!doc) throw new BadRequestException('Documento ID no válido');
        if (!cuota) throw new BadRequestException('Cuota ID no válido');
        if (!user) throw new BadRequestException('user ID no válido');

        const newPagoCuotaDeleted: CxPCuota = await tx.cxPCuota.delete({
          where: {
            id: cuotaId,
          },
        });
      });
    } catch (error) {
      this.logger.error('Error en eliminar pago de cuota: ', error?.stack);
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'Fatal error: Error inesperado en modulo: eliminar pago de cuota',
      );
    }
  }
}
