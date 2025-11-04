import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { CreateCuotasMoraCronDto } from './dto/create-cuotas-mora-cron.dto';
import { UpdateCuotasMoraCronDto } from './dto/update-cuotas-mora-cron.dto';
//
import * as dayjs from 'dayjs';
import 'dayjs/locale/es';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';
import * as isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import * as isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import * as customParseFormat from 'dayjs/plugin/customParseFormat';
import { PrismaService } from 'src/prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EstadoPago, NotiSeverity, Rol } from '@prisma/client';
import {
  CreditoVentaCuotaSelect,
  SelectCreditosActivos,
} from './select/selectCredito';
import { TZGT } from 'src/utils/utils';
import { NotificationService } from 'src/notification/notification.service';
import { UiNotificacionDTO } from 'src/notification/common/UINotificationDto';
dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.locale('es');

@Injectable()
export class CuotasMoraCronService {
  private readonly logger = new Logger(CuotasMoraCronService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly noti: NotificationService,
  ) {}

  // Ejecuta poco después de medianoche GT
  // @Cron(CronExpression.EVERY_10_SECONDS, {
  //   name: 'creditos.mora.daily',
  //   timeZone: TZGT,
  // })
  @Cron('0 4 * * *', {
    name: 'creditos.mora.daily',
    timeZone: TZGT, // 'America/Guatemala'
  })
  async accrueMoraAndRemindOnceDaily() {
    try {
      const creditos = await this.prisma.ventaCuota.findMany({
        where: { estado: { in: ['ACTIVA', 'EN_MORA'] as any } },
        select: SelectCreditosActivos,
      });

      this.logger.log(
        'Los creditos activos de ventas con cuotas son: ',
        creditos,
      );

      for (const credito of creditos) {
        await this.processCredito(credito);
      }
    } catch (error) {
      this.logger.error('Cron mora (daily) falló', error?.stack);
      throw new InternalServerErrorException('Cron mora: error inesperado');
    }
  }

  private async processCredito(credito: any) {
    const today = dayjs().tz(TZGT).startOf('day');

    const interes = Number(credito.interes ?? 0);
    const hasInterest = interes > 0;
    const tasaDiaria = hasInterest ? interes / 100 / 365 : 0;

    for (const c of credito.cuotas) {
      const venc = dayjs(c.fechaVencimiento).tz(TZGT).startOf('day');

      // sin días de gracia
      if (!today.isAfter(venc)) continue;

      //  si ya calculaste hoy, salta
      if (c.fechaUltimoCalculoMora) {
        const lastCalc = dayjs(c.fechaUltimoCalculoMora)
          .tz(TZGT)
          .startOf('day');
        if (lastCalc.isSame(today, 'day')) {
          // Ya se calculó hoy → si no hay interés, igual marca ATRASADA/recordatorio; si hay interés, skip.
          if (!hasInterest) {
            await this.markAtrasadaYNotificar(credito, c, today, false, 0);
          }
          continue;
        }
      }

      // delta de días idempotente
      const last = c.fechaUltimoCalculoMora
        ? dayjs(c.fechaUltimoCalculoMora).tz(TZGT).startOf('day')
        : venc; // primera vez, desde el vencimiento

      const from = last.isAfter(venc) ? last : venc;
      const dias = Math.max(0, today.diff(from, 'day'));
      if (dias === 0) {
        if (!hasInterest) {
          await this.markAtrasadaYNotificar(credito, c, today, false, 0);
        }
        continue;
      }

      // saldo de capital (sin incluir mora)
      const esperado = (c.montoEsperado ?? c.monto) || 0;
      const saldoCapital = Math.max(0, esperado - (c.montoPagado ?? 0));
      if (saldoCapital <= 0) {
        await this.markAtrasadaYNotificar(credito, c, today, false, 0);
        continue;
      }

      if (!hasInterest) {
        await this.markAtrasadaYNotificar(credito, c, today, false, 0);
        continue;
      }

      // mora
      const moraDeltaRaw = saldoCapital * tasaDiaria * dias;
      const moraDelta = Math.round(moraDeltaRaw * 10000) / 10000;
      if (moraDelta > 0) {
        await this.applyMoraDelta(credito, c, today, moraDelta, dias);
      } else {
        await this.markAtrasadaYNotificar(credito, c, today, false, 0);
      }
    }
  }

  private async markAtrasadaYNotificar(
    credito: any,
    cuota: any,
    today: dayjs.Dayjs,
    withMora: boolean,
    moraDelta: number,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.ventaCuota.update({
        where: { id: credito.id },
        data: { estado: 'EN_MORA' },
      });

      if (cuota.estado !== 'ATRASADA') {
        await tx.cuota.update({
          where: { id: cuota.id },
          data: { estado: 'ATRASADA' },
        });
      }

      await tx.ventaCuotaHistorial.create({
        data: {
          ventaCuotaId: credito.id,
          accion: withMora ? 'MORA_REGISTRADA' : 'CAMBIO_ESTADO',
          comentario: withMora
            ? `Mora registrada: +Q${moraDelta.toFixed(2)}`
            : `Cuota #${cuota.numero} vencida (sin interés configurado)`,
        },
      });
    });

    await this.notify(
      credito,
      cuota,
      withMora ? 'ALERTA' : 'INFORMACION',
      withMora,
      moraDelta,
      today,
    );
  }

  private async applyMoraDelta(
    credito: any,
    cuota: any,
    today: dayjs.Dayjs,
    moraDeltaInput: number,
    dias: number,
  ) {
    const moraDelta = Math.round(Number(moraDeltaInput) * 10000) / 10000;

    await this.prisma.$transaction(async (tx) => {
      const before = await tx.cuota.findUnique({
        where: { id: cuota.id },
        select: {
          id: true,
          numero: true,
          monto: true,
          montoEsperado: true,
          montoPagado: true,
          moraAcumulada: true,
          fechaUltimoCalculoMora: true,
        },
      });
      if (!before) return; // cuota ya no existe? salir silenciosamente o lanza error

      // Asegura que el crédito quede marcado en EN_MORA
      await tx.ventaCuota.update({
        where: { id: credito.id },
        data: { estado: 'EN_MORA' },
      });

      const esperado = Number(before.montoEsperado ?? before.monto ?? 0);
      const pagado = Number(before.montoPagado ?? 0);

      const after = await tx.cuota.update({
        where: { id: before.id },
        data: {
          moraAcumulada: { increment: moraDelta },
          estado: 'ATRASADA',
          fechaUltimoCalculoMora: today.toDate(), // idempotencia diaria
        },
        select: {
          id: true,
          numero: true,
          monto: true,
          montoEsperado: true,
          montoPagado: true,
          moraAcumulada: true,
          fechaUltimoCalculoMora: true,
        },
      });

      // 🔎 LOG claro (4 decimales) — evita toFixed(2) para no “esconder” deltas pequeños
      const saldoBase = Math.max(0, esperado - pagado);
      this.logger.log(
        `[MORA] credito=${credito.id} cuota=${before.id}#${before.numero} ` +
          `dias=${dias} delta=${moraDelta.toFixed(4)} | ` +
          `mora: ${Number(before.moraAcumulada ?? 0).toFixed(4)} -> ${Number(after.moraAcumulada ?? 0).toFixed(4)} | ` +
          `saldoBase=Q${saldoBase.toFixed(2)} corte=${today.format('YYYY-MM-DD')}`,
      );

      // Historial con meta opcional (útil para auditoría)
      await tx.ventaCuotaHistorial.create({
        data: {
          ventaCuotaId: credito.id,
          accion: 'MORA_REGISTRADA',
          comentario: `Cuota #${after.numero}: +Q${moraDelta.toFixed(4)} por ${dias} día(s).`,
          // meta: { dias, delta: moraDelta, saldoBase, corte: today.format('YYYY-MM-DD') } as any,
        },
      });
    });

    // Notificación fuera de la transacción
    await this.notify(credito, cuota, 'ALERTA', true, moraDelta, today);
  }

  private async notify(
    credito: any,
    cuota: any,
    severidad: NotiSeverity | 'ALERTA' | 'INFORMACION',
    withMora: boolean,
    moraDelta: number,
    today: dayjs.Dayjs,
  ) {
    const userId = credito?.responsableCobroId;
    if (!userId) return;

    await this.noti.createOne({
      userId,
      categoria: 'CREDITO',
      severidad: withMora ? 'ALERTA' : 'INFORMACION',
      titulo: withMora
        ? 'Mora registrada en cuota'
        : 'Cuota vencida (recordatorio)',
      mensaje: withMora
        ? `Cuota #${cuota.numero} ha acumulado Q${moraDelta.toFixed(2)} de mora.`
        : `Cuota #${cuota.numero} vencida. Favor gestionar cobro.`,
      route: null, // si tienes ruta del crédito, colócala: `/creditos/${credito.id}`
      actionLabel: 'Ver crédito',
      meta: {
        creditoId: credito.id,
        cuotaId: cuota.id,
        fecha: today.format('YYYY-MM-DD'),
      } as any,
      referenciaTipo: 'Cuota',
      referenciaId: cuota.id,
      sucursalId: credito.sucursalId ?? null,
    });
  }
}
