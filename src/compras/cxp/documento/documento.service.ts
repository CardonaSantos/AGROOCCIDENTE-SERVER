import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { CreateDocumentoDto, PlanCuotaFila } from './dto/create-documento.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import * as dayjs from 'dayjs';
import 'dayjs/locale/es';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';
import * as isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import * as isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import * as customParseFormat from 'dayjs/plugin/customParseFormat';
import { TZGT } from 'src/utils/utils';
import {
  CondicionPago,
  CxPCuota,
  CxPDocumento,
  CxPPago,
  CxPPagoCuota,
  Prisma,
} from '@prisma/client';
import { MovimientoFinancieroService } from 'src/movimiento-financiero/movimiento-financiero.service';
import { CreateMFUtility } from 'src/movimiento-financiero/utilities/createMFDto';
dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.locale('es');

/**
 * NOTAS DE DISEÑO
 * - Esta versión asume que el FRONT envía el array de cuotas definitivo (ordenado y editable por el usuario).
 * - Si hay enganche (PRIMERA_MAYOR) y se marca "registrarPagoEngancheAhora", se paga la CUOTA #1 en la misma transacción.
 * - No se crean cuotas "extra" por el enganche: la #1 del plan ES el enganche.
 * - Se recalculan saldoPendiente, interesTotal y estado del documento después de crear cuotas y, si aplica, del pago inicial.
 */

function isNil(v: any) {
  return v === null || v === undefined;
}
const round2 = (n: number) => Math.round(n * 100) / 100;

@Injectable()
export class DocumentoService {
  private readonly logger = new Logger(DocumentoService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly movimientoFinanciero: MovimientoFinancieroService,
  ) {}

  /** Valida presencia de props no-nulas */
  private requiereProps(obj: Record<string, any>, requerido: string[]) {
    const faltantes = requerido.filter((k) => isNil(obj[k]));
    if (faltantes.length) {
      throw new BadRequestException(
        `Faltan los campos: ${faltantes.join(', ')}`,
      );
    }
  }

  async getRegists() {
    return await this.prisma.cxPDocumento.findMany({
      include: {
        condicionPago: true,
        pagos: true,
        cuotas: true,
        usuario: true,
        proveedor: true,
        compra: true,
      },
    });
  }

  /**
   *
   * @param dto Crear credito funcion Main (y sus derivados)
   */
  async createCreditoRegist(dto: CreateDocumentoDto) {
    try {
      this.logger.log(`DTO recibido:\n${JSON.stringify(dto, null, 2)}`);

      this.requiereProps(dto, [
        'usuarioId',
        'compraId',
        'diasCredito',
        'diasEntrePagos',
        'proveedorId',
        'montoOriginal',
      ]);

      if (!Array.isArray(dto.cuotas) || dto.cuotas.length === 0) {
        throw new BadRequestException(
          'Debes enviar el arreglo de cuotas generado por la UI.',
        );
      }

      // Normalizaciones menores
      if (dto.interesTipo === 'NONE') dto.interes = 0;
      if (dto.interes > 1) dto.interes = dto.interes / 100; // admite 2 como 2%.

      // Reglas de enganche vs plan enviado
      if (dto.planCuotaModo === 'PRIMERA_MAYOR' && (dto.enganche ?? 0) <= 0) {
        throw new BadRequestException(
          'Plan PRIMERA_MAYOR requiere un enganche > 0.',
        );
      }
      if (dto.planCuotaModo === 'IGUALES') dto.enganche = 0;

      const result = await this.prisma.$transaction(async (tx) => {
        // 1) Validaciones de integridad de compra/proveedor (mínimas)
        const compra = await tx.compra.findUnique({
          where: { id: dto.compraId },
          select: { id: true, total: true, proveedorId: true },
        });
        if (!compra) throw new BadRequestException('Compra no encontrada.');
        if (compra.proveedorId !== dto.proveedorId) {
          throw new BadRequestException(
            'El proveedor no coincide con la compra.',
          );
        }

        // 2) Monto base y consistencia con cuotas
        const montoBase = Number(dto.montoOriginal ?? compra.total);
        const sumaCuotas = round2(
          dto.cuotas!.reduce((a, c) => a + Number(c.monto), 0),
        );
        const interesTotal = round2(sumaCuotas - montoBase);
        if (montoBase <= 0)
          throw new BadRequestException('montoOriginal debe ser > 0.');

        // si hay enganche, validar que la cuota #1 sea coherente
        if (dto.enganche && dto.cuotas![0]) {
          const diff = Math.abs(
            Number(dto.cuotas![0].monto) - Number(dto.enganche),
          );
          if (diff > 0.01) {
            throw new BadRequestException(
              'El monto de la cuota #1 no coincide con el enganche.',
            );
          }
        }

        // 3) Snapshot de condición de pago (opcional pero útil para auditoría)
        const condicionPago = await tx.condicionPago.create({
          data: {
            nombre: `Condición compra #${dto.compraId}`,
            diasCredito: dto.diasCredito,
            cantidadCuotas: dto.cantidadCuotas,
            diasEntreCuotas: dto.diasEntrePagos,
            interes: dto.interes,
            tipoInteres: dto.interesTipo,
            modoGeneracion: dto.planCuotaModo,
          },
        });

        // 4) Cabecera CxPDocumento
        const doc = await tx.cxPDocumento.create({
          data: {
            proveedorId: dto.proveedorId,
            compraId: dto.compraId,
            folioProveedor: 'XD',
            fechaEmision: new Date(dto.fechaEmisionISO),
            fechaVencimiento: new Date(
              dto.cuotas![dto.cuotas!.length - 1].fechaISO,
            ), // última cuota
            montoOriginal: montoBase,
            saldoPendiente: 0, // se ajusta después
            interesTotal,
            estado: 'PENDIENTE',
            condicionPagoId: condicionPago.id,
            usuarioId: dto.usuarioId,

            // Si tienes el campo en el schema (migración):
            // usuarioId: dto.usuarioId,
          },
        });

        // 5) Crear cuotas (usa las que vienen de la UI, re-indexadas por seguridad)
        const cuotasCreadas = await this.createCuotasForDocumento(
          tx,
          doc.id,
          dto.cuotas!,
        );

        // 6) Pago inmediato del enganche (opcional)
        if (dto.registrarPagoEngancheAhora && (dto.enganche ?? 0) > 0) {
          await this.pagarEngancheAhoraTx(tx, {
            documentoId: doc.id,
            proveedorId: dto.proveedorId,
            usuarioId: dto.usuarioId,
            sucursalId: dto.sucursalId,
            cuentaBancariaId: dto.cuentaBancariaId,
            metodoPago: dto.metodoPago,
            descripcion: dto.descripcion,
            monto: Number(dto.enganche),
          });
        }

        // 7) Recalcular saldo del documento + estado
        await this.actualizarSaldosDocumentoTx(tx, doc.id, montoBase);

        // 8) Devolver documento con cuotas/pagos
        return tx.cxPDocumento.findUnique({
          where: { id: doc.id },
          include: {
            cuotas: true,
            pagos: true,
            condicionPago: true,
          },
        });
      });

      return result;
    } catch (error) {
      this.logger.error(
        'Error al crear crédito de compra',
        error?.stack || error,
      );
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'Error inesperado al crear el crédito.',
      );
    }
  }

  /** Crea todas las cuotas del documento basándose en el array proveniente del front. */
  private async createCuotasForDocumento(
    tx: Prisma.TransactionClient,
    documentoId: number,
    cuotasUI: PlanCuotaFila[],
  ) {
    // Re-indexar números por seguridad y respetar fechas/montos enviados
    const tasks = cuotasUI.map((c, idx) =>
      tx.cxPCuota.create({
        data: {
          documentoId,
          numero: idx + 1,
          fechaVencimiento: new Date(c.fechaISO),
          monto: Number(c.monto),
          saldo: Number(c.monto),
          estado: 'PENDIENTE',
        },
      }),
    );
    return Promise.all(tasks);
  }

  /** Paga la cuota #1 (enganche) creando Movimiento, Pago y Pago↔Cuota. */
  private async pagarEngancheAhoraTx(
    tx: Prisma.TransactionClient,
    args: {
      documentoId: number;
      proveedorId: number;
      usuarioId: number;
      sucursalId: number;
      cuentaBancariaId?: number;
      metodoPago: any; // enum MetodoPago
      descripcion?: string;
      monto: number;
    },
  ) {
    // localizar cuota #1
    const cuota1 = await tx.cxPCuota.findFirst({
      where: { documentoId: args.documentoId, numero: 1 },
    });
    if (!cuota1)
      throw new BadRequestException(
        'No se encontró la cuota #1 para aplicar el enganche.',
      );

    // Validar monto coherente con saldo
    const toPay = Math.min(Number(args.monto), Number(cuota1.saldo));
    if (toPay <= 0)
      throw new BadRequestException('El monto de enganche es inválido.');

    // 1) Movimiento financiero (usa tu servicio utilitario)
    const mov = await this.movimientoFinanciero.createMovimiento(
      {
        sucursalId: args.sucursalId,
        usuarioId: args.usuarioId,
        proveedorId: args.proveedorId,
        cuentaBancariaId: args.cuentaBancariaId,
        monto: toPay,
        motivo: 'PAGO_CREDITO', // ⚠️ Ajusta al MotivoMovimiento correcto en tu enum
        metodoPago: args.metodoPago,
        descripcion: args.descripcion ?? 'Pago de enganche (cuota #1) CxP',
      } as CreateMFUtility,
      { tx },
    );

    // 2) Pago CxP
    const pago = await tx.cxPPago.create({
      data: {
        fechaPago: new Date(),
        monto: toPay,
        metodoPago: args.metodoPago,
        referencia: `ENG-${args.documentoId}-${dayjs().tz(TZGT).format('YYYYMMDDHHmm')}`,
        observaciones: 'Pago de enganche (cuota #1)',
        movimientoFinanciero: {
          connect: {
            id: mov.id,
          },
        },
        documento: {
          connect: {
            id: args.documentoId,
          },
        },
        registradoPor: {
          connect: {
            id: args.usuarioId,
          },
        },
        // registradoPorId: args.usuarioId, // si tu schema lo tiene
      },
    });

    // 3) Vínculo Pago↔Cuota
    await tx.cxPPagoCuota.create({
      data: { pagoId: pago.id, cuotaId: cuota1.id, monto: toPay },
    });

    // 4) Cerrar cuota si procede
    const nuevoSaldo = round2(Number(cuota1.saldo) - toPay);
    await tx.cxPCuota.update({
      where: { id: cuota1.id },
      data: {
        saldo: nuevoSaldo,
        estado: nuevoSaldo <= 0 ? 'PAGADA' : 'PARCIAL',
        pagadaEn: nuevoSaldo <= 0 ? new Date() : null,
      },
    });
  }

  /** Recalcula saldo y estado del documento tras crear cuotas y/o aplicar pagos. */
  private async actualizarSaldosDocumentoTx(
    tx: Prisma.TransactionClient,
    documentoId: number,
    montoOriginal: number,
  ) {
    const cuotas = await tx.cxPCuota.findMany({ where: { documentoId } });
    const saldoDoc = round2(cuotas.reduce((a, c) => a + Number(c.saldo), 0));
    const totalCuotas = round2(cuotas.reduce((a, c) => a + Number(c.monto), 0));
    const interesTotal = round2(totalCuotas - Number(montoOriginal));

    await tx.cxPDocumento.update({
      where: { id: documentoId },
      data: {
        saldoPendiente: saldoDoc,
        interesTotal,
        estado:
          saldoDoc <= 0
            ? 'PAGADO'
            : saldoDoc < totalCuotas
              ? 'PARCIAL'
              : 'PENDIENTE',
      },
    });
  }
}
