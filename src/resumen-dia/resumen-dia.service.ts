import { CreateResumenDiaDto } from './dto/create-resumen-dia.dto';
import { UpdateResumenDiaDto } from './dto/update-resumen-dia.dto';
import { ResumenDiarioResponse, ResumenDiarioSucursal } from './types';
import { PrismaService } from 'src/prisma/prisma.service';
import * as dayjs from 'dayjs';
import 'dayjs/locale/es';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';
import * as isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import * as isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import { UtilidadesService } from 'src/caja/utilidades/utilidades.service';
import { TZGT } from 'src/utils/utils';
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.locale('es');
type Q = { fecha?: string; sucursalId?: number | string };

// caja-admin.service.ts
import { BadRequestException, Injectable, Logger } from '@nestjs/common';

type QDiario = { fecha?: string; sucursalId?: number };
type QHistorico = { desde: string; hasta: string; sucursalId?: number };
type QMensual = { mes: string; sucursalId?: number }; // mes = 'YYYY-MM'

@Injectable()
export class ResumenDiaService {
  private readonly logger = new Logger(ResumenDiaService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly utilidades: UtilidadesService,
  ) {}

  // async getResumenDiario(query: Q): Promise<ResumenDiarioResponse> {
  //   // 1) Día en TZ GT
  //   const base = query.fecha ? dayjs.tz(query.fecha, TZGT) : dayjs().tz(TZGT);
  //   const start = base.startOf('day');
  //   const end = base.endOf('day');
  //   const fechaISO = start.toDate().toISOString();

  //   // 2) Sucursales objetivo
  //   const sucIds: Array<{ id: number; nombre: string }> = query.sucursalId
  //     ? ([
  //         await this.prisma.sucursal.findUniqueOrThrow({
  //           where: { id: Number(query.sucursalId) },
  //           select: { id: true, nombre: true },
  //         }),
  //       ] as any)
  //     : await this.prisma.sucursal.findMany({
  //         select: { id: true, nombre: true },
  //       });

  //   // 3) Construimos en paralelo por sucursal
  //   const items: ResumenDiarioSucursal[] = await Promise.all(
  //     sucIds.map(async (suc) => {
  //       // a) Cajas cerradas/arqueo cuyo cierre fue en el día
  //       const cajas = await this.prisma.registroCaja.findMany({
  //         where: {
  //           sucursalId: suc.id,
  //           estado: { in: ['CERRADO', 'ARQUEO'] },
  //           fechaCierre: { gte: start.toDate(), lte: end.toDate() },
  //         },
  //         orderBy: { fechaCierre: 'asc' },
  //         select: { id: true, saldoInicial: true, fechaCierre: true },
  //       });

  //       const cajaIds = cajas.map((c) => c.id);
  //       const registros = cajaIds.length;

  //       // b) Snapshot del día (si existe)
  //       const fechaSnap = new Date(start.year(), start.month(), start.date());
  //       const snap = await this.prisma.sucursalSaldoDiario.findFirst({
  //         where: { sucursalId: suc.id, fechaGenerado: fechaSnap },
  //         select: {
  //           saldoInicio: true,
  //           saldoFinal: true,
  //           totalIngresos: true,
  //           totalEgresos: true,
  //         },
  //       });

  //       // c) Saldo inicio: primero del día o snapshot
  //       // const saldoInicio = cajas[0]?.saldoInicial ?? snap?.saldoInicio ?? 0;
  //       //priorizar snapshoot del dia sino toma caja
  //       const saldoInicio = snap?.saldoInicio ?? cajas[0]?.saldoInicial ?? 0;

  //       // d) Totales “oficiales” del día sumando cada turno con tu helper
  //       //    (esto garantiza que ingresos/egresos calcen contra tu lógica de cierre)
  //       let ingresosTotal = 0;
  //       let egresosTotal = 0;
  //       let ventasEfectivoTotal = 0;

  //       if (cajaIds.length) {
  //         const totalesPorTurno = await Promise.all(
  //           cajaIds.map((id) =>
  //             this.utilidades.calcularTotalesTurno(this.prisma, id),
  //           ),
  //         );
  //         for (const t of totalesPorTurno) {
  //           ingresosTotal += t.ingresos;
  //           egresosTotal += t.egresos;
  //           ventasEfectivoTotal += t.ventasEfectivo;
  //         }
  //       } else {
  //         // si no hubo cierres ese día, usa snapshot o 0
  //         ingresosTotal = snap?.totalIngresos ?? 0;
  //         egresosTotal = snap?.totalEgresos ?? 0;
  //       }

  //       // e) Desglose por categorías (sobre todos los movimientos de los turnos del día)
  //       let otrosIngresos = 0;
  //       let gastosOperativos = 0;
  //       let costoVenta = 0;
  //       let depositosProveedor = 0;
  //       let depositosCierre = 0;
  //       let otrosEgresos = 0;

  //       if (cajaIds.length) {
  //         const movimientos = await this.prisma.movimientoCaja.findMany({
  //           where: { registroCajaId: { in: cajaIds } },
  //           select: { tipo: true, categoria: true, monto: true },
  //         });

  //         for (const m of movimientos) {
  //           // Ingresos “no ventas”
  //           if (
  //             m.tipo === 'INGRESO' ||
  //             m.tipo === 'ABONO' ||
  //             m.tipo === 'TRANSFERENCIA'
  //           ) {
  //             otrosIngresos += m.monto;
  //             continue;
  //           }
  //           // Egresos clasificados
  //           if (m.tipo === 'EGRESO') {
  //             if (m.categoria === 'GASTO_OPERATIVO')
  //               gastosOperativos += m.monto;
  //             else if (m.categoria === 'COSTO_VENTA') costoVenta += m.monto;
  //             else otrosEgresos += m.monto;
  //             continue;
  //           }
  //           // Depósitos
  //           if (m.tipo === 'DEPOSITO_BANCO') {
  //             if (m.categoria === 'DEPOSITO_PROVEEDOR')
  //               depositosProveedor += m.monto;
  //             else if (m.categoria === 'DEPOSITO_CIERRE')
  //               depositosCierre += m.monto;
  //             else otrosEgresos += m.monto; // otros depósitos no clasificados
  //             continue;
  //           }
  //           // Otros egresos (retiro/cheque)
  //           if (m.tipo === 'RETIRO' || m.tipo === 'CHEQUE') {
  //             otrosEgresos += m.monto;
  //           }
  //         }
  //       }

  //       // f) Asegurar coherencia: ingresos = ventasEfectivo + otrosIngresos
  //       //    egresos = suma desglose (incl. otrosEgresos)
  //       //    Si por alguna razón difiere del total “oficial”, mantenemos los totales oficiales
  //       //    y dejamos el desglose informativo (casos raros con tipos nuevos).
  //       // const ingresosDesglosados = ventasEfectivoTotal + otrosIngresos;
  //       // const egresosDesglosados =
  //       //   gastosOperativos +
  //       //   costoVenta +
  //       //   depositosProveedor +
  //       //   depositosCierre +
  //       //   otrosEgresos;
  //       const ingresosDesglosados = ventasEfectivoTotal + otrosIngresos;
  //       const egresosDesglosados =
  //         gastosOperativos +
  //         costoVenta +
  //         depositosProveedor +
  //         depositosCierre +
  //         otrosEgresos;

  //       // const ingresos = ingresosTotal || ingresosDesglosados;
  //       // const egresos = egresosTotal || egresosDesglosados;
  //       const ingresos = cajaIds.length
  //         ? ingresosTotal
  //         : (ingresosDesglosados ?? 0);
  //       const egresos = cajaIds.length
  //         ? egresosTotal
  //         : (egresosDesglosados ?? 0);

  //       // g) Saldo final preferido: snapshot si existe; si no, fórmula
  //       const saldoFinal = snap?.saldoFinal ?? saldoInicio + ingresos - egresos;

  //       const item: ResumenDiarioSucursal = {
  //         fecha: start.format('YYYY-MM-DD'),
  //         sucursal: { id: suc.id, nombre: suc.nombre },
  //         saldoInicio,
  //         totales: {
  //           ventasEfectivo: ventasEfectivoTotal,
  //           otrosIngresos,
  //           gastosOperativos,
  //           costoVenta,
  //           depositosProveedor,
  //           depositosCierre,
  //           otrosEgresos,
  //         },
  //         ingresos,
  //         egresos,
  //         saldoFinal,
  //         registros,
  //       };
  //       return item;
  //     }),
  //   );

  //   return { fecha: fechaISO, items };
  // }

  // ==========> DIARIO (ya lo tenías, lo dejo tal cual con mínimos retoques)
  async getResumenDiario(query: QDiario): Promise<ResumenDiarioResponse> {
    const base = query.fecha ? dayjs.tz(query.fecha, TZGT) : dayjs().tz(TZGT);
    const start = base.startOf('day');
    const end = base.endOf('day');
    const fechaISO = start.toDate().toISOString();

    const sucIds: Array<{ id: number; nombre: string }> = query.sucursalId
      ? ([
          await this.prisma.sucursal.findUniqueOrThrow({
            where: { id: Number(query.sucursalId) },
            select: { id: true, nombre: true },
          }),
        ] as any)
      : await this.prisma.sucursal.findMany({
          select: { id: true, nombre: true },
        });

    const items: ResumenDiarioSucursal[] = await Promise.all(
      sucIds.map(async (suc) => {
        // Cajas cerradas/arqueo cuyo CIERRE fue en el día
        const cajas = await this.prisma.registroCaja.findMany({
          where: {
            sucursalId: suc.id,
            estado: { in: ['CERRADO', 'ARQUEO'] },
            fechaCierre: { gte: start.toDate(), lte: end.toDate() },
          },
          orderBy: { fechaCierre: 'asc' },
          select: { id: true, saldoInicial: true, fechaCierre: true },
        });

        const cajaIds = cajas.map((c) => c.id);
        const registros = cajaIds.length;

        // Snapshot del día (si existe)
        const fechaSnap = new Date(start.year(), start.month(), start.date());
        const snap = await this.prisma.sucursalSaldoDiario.findFirst({
          where: { sucursalId: suc.id, fechaGenerado: fechaSnap },
          select: {
            saldoInicio: true,
            saldoFinal: true,
            totalIngresos: true,
            totalEgresos: true,
          },
        });

        // Prioriza snapshot (si existe); si no, toma la primera caja del día
        const saldoInicio = snap?.saldoInicio ?? cajas[0]?.saldoInicial ?? 0;

        // Totales oficiales por turno (tu helper)
        let ingresosTotal = 0;
        let egresosTotal = 0;
        let ventasEfectivoTotal = 0;

        if (cajaIds.length) {
          const totalesPorTurno = await Promise.all(
            cajaIds.map((id) =>
              this.utilidades.calcularTotalesTurno(this.prisma as any, id),
            ),
          );
          for (const t of totalesPorTurno) {
            ingresosTotal += t.ingresos;
            egresosTotal += t.egresos;
            ventasEfectivoTotal += t.ventasEfectivo;
          }
        } else {
          ingresosTotal = snap?.totalIngresos ?? 0;
          egresosTotal = snap?.totalEgresos ?? 0;
        }

        // Desglose por categorías en los movimientos de esos turnos
        let otrosIngresos = 0;
        let gastosOperativos = 0;
        let costoVenta = 0;
        let depositosProveedor = 0;
        let depositosCierre = 0;
        let otrosEgresos = 0;

        if (cajaIds.length) {
          const movimientos = await this.prisma.movimientoCaja.findMany({
            where: { registroCajaId: { in: cajaIds } },
            select: { tipo: true, categoria: true, monto: true },
          });

          for (const m of movimientos) {
            if (
              m.tipo === 'INGRESO' ||
              m.tipo === 'ABONO' ||
              m.tipo === 'TRANSFERENCIA'
            ) {
              otrosIngresos += m.monto;
              continue;
            }
            if (m.tipo === 'EGRESO') {
              if (m.categoria === 'GASTO_OPERATIVO')
                gastosOperativos += m.monto;
              else if (m.categoria === 'COSTO_VENTA') costoVenta += m.monto;
              else otrosEgresos += m.monto;
              continue;
            }
            if (m.tipo === 'DEPOSITO_BANCO') {
              if (m.categoria === 'DEPOSITO_PROVEEDOR')
                depositosProveedor += m.monto;
              else if (m.categoria === 'DEPOSITO_CIERRE')
                depositosCierre += m.monto;
              else otrosEgresos += m.monto;
              continue;
            }
            if (m.tipo === 'RETIRO' || m.tipo === 'CHEQUE') {
              otrosEgresos += m.monto;
            }
          }
        }

        const ingresosDesglosados = ventasEfectivoTotal + otrosIngresos;
        const egresosDesglosados =
          gastosOperativos +
          costoVenta +
          depositosProveedor +
          depositosCierre +
          otrosEgresos;

        const ingresos = cajaIds.length ? ingresosTotal : ingresosDesglosados;
        const egresos = cajaIds.length ? egresosTotal : egresosDesglosados;

        const saldoFinal = snap?.saldoFinal ?? saldoInicio + ingresos - egresos;

        return {
          fecha: start.format('YYYY-MM-DD'),
          sucursal: { id: suc.id, nombre: suc.nombre },
          saldoInicio,
          totales: {
            ventasEfectivo: ventasEfectivoTotal,
            otrosIngresos,
            gastosOperativos,
            costoVenta,
            depositosProveedor,
            depositosCierre,
            otrosEgresos,
          },
          ingresos,
          egresos,
          saldoFinal,
          registros,
        };
      }),
    );

    return { fecha: fechaISO, items };
  }

  // ==========> HISTÓRICO (rango de fechas, agrupado por día)
  async getResumenHistorico(q: QHistorico) {
    if (!q.desde || !q.hasta) {
      throw new BadRequestException(
        'desde y hasta son requeridos (YYYY-MM-DD)',
      );
    }

    const d0 = dayjs.tz(q.desde, TZGT).startOf('day');
    const d1 = dayjs.tz(q.hasta, TZGT).endOf('day');
    if (d1.isBefore(d0)) throw new BadRequestException('Rango inválido');

    const dias: Array<{ fecha: string; items: ResumenDiarioSucursal[] }> = [];
    let cursor = d0.clone();
    while (cursor.isBefore(d1) || cursor.isSame(d1, 'day')) {
      const daily = await this.getResumenDiario({
        fecha: cursor.format('YYYY-MM-DD'),
        sucursalId: q.sucursalId,
      });
      dias.push({ fecha: daily.fecha, items: daily.items });
      cursor = cursor.add(1, 'day');
    }

    // Totales del rango (caja y banco)
    const totales = dias.reduce(
      (acc, d) => {
        for (const it of d.items) {
          const ingresosCaja =
            it.totales.ventasEfectivo + it.totales.otrosIngresos;
          const egresosCaja =
            it.totales.gastosOperativos +
            it.totales.costoVenta +
            it.totales.depositosProveedor +
            it.totales.otrosEgresos +
            it.totales.depositosCierre;
          acc.caja.saldoInicio += it.saldoInicio;
          acc.caja.ingresos += ingresosCaja;
          acc.caja.egresos += egresosCaja;
          acc.caja.saldoFinal += it.saldoFinal;
          acc.caja.resultadoOperativo +=
            it.totales.ventasEfectivo -
            it.totales.costoVenta -
            it.totales.gastosOperativos;
          acc.caja.registros += it.registros;

          acc.banco.ingresos += it.totales.depositosCierre; // “INGRESO” para Administrador
        }
        return acc;
      },
      {
        caja: {
          saldoInicio: 0,
          ingresos: 0,
          egresos: 0,
          saldoFinal: 0,
          resultadoOperativo: 0,
          registros: 0,
        },
        banco: { ingresos: 0, egresos: 0 },
      },
    );

    return {
      desde: d0.toDate().toISOString(),
      hasta: d1.toDate().toISOString(),
      dias,
      totales,
    };
  }

  // ==========> FLUJO MENSUAL (para gráficas)
  async getFlujoMensual(q: QMensual) {
    if (!q.mes) throw new BadRequestException('mes es requerido (YYYY-MM)');

    const start = dayjs.tz(`${q.mes}-01`, TZGT).startOf('month');
    const end = start.endOf('month');
    const hist = await this.getResumenHistorico({
      desde: start.format('YYYY-MM-DD'),
      hasta: end.format('YYYY-MM-DD'),
      sucursalId: q.sucursalId,
    });

    const series = hist.dias.map((d) => {
      const agg = d.items.reduce(
        (acc, it) => {
          acc.ingresos += it.totales.ventasEfectivo + it.totales.otrosIngresos;
          acc.egresos +=
            it.totales.gastosOperativos +
            it.totales.costoVenta +
            it.totales.depositosProveedor +
            it.totales.otrosEgresos +
            it.totales.depositosCierre;
          acc.depositoBanco += it.totales.depositosCierre;
          acc.pnl +=
            it.totales.ventasEfectivo -
            it.totales.costoVenta -
            it.totales.gastosOperativos;
          return acc;
        },
        { ingresos: 0, egresos: 0, depositoBanco: 0, pnl: 0 },
      );
      return {
        fecha: dayjs(d.fecha).tz(TZGT).format('YYYY-MM-DD'),
        ...agg,
      };
    });

    return {
      mes: start.format('YYYY-MM'),
      sucursalId: q.sucursalId ?? null,
      series, // para gráfica de barras/área
      totales: hist.totales, // resumen del mes
    };
  }
}
