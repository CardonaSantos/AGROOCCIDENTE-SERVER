import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CreateUtilityDto } from './dto/create-utility.dto';
import { UpdateUtilityDto } from './dto/update-utility.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { EstadoTurnoCaja, Prisma } from '@prisma/client';
import { GenerateStockDto } from './dto/generate-stock.dto';
import { EntregaStockData } from './utils';
import { StockPresentacionDto } from 'src/compras-requisiciones/interfaces';

type GenerateStockPresentacionDto = StockPresentacionDto;

@Injectable()
export class UtilitiesService {
  private readonly logger = new Logger(UtilitiesService.name);
  constructor(private readonly prisma: PrismaService) {}

  async generateStockFromRequisicion(
    tx: Prisma.TransactionClient,
    dtos: GenerateStockDto[],
    entregaStockData?: EntregaStockData,
  ) {
    this.logger.log('El dto entrando a generar el stock es: ', dtos);

    let entregaStock;

    if (entregaStockData) {
      entregaStock = await tx.entregaStock.create({
        data: {
          proveedor: {
            connect: {
              id: entregaStockData.proveedorId,
            },
          },
          montoTotal: entregaStockData.montoTotal,
          fechaEntrega: entregaStockData.fechaEntrega ?? new Date(),
          usuarioRecibido: {
            connect: {
              id: entregaStockData.recibidoPorId,
            },
          },
          sucursal: {
            connect: {
              id: entregaStockData.sucursalId,
            },
          },
        },
      });
    }

    const newStocksCreated = await Promise.all(
      dtos.map((prod) =>
        tx.stock.create({
          data: {
            cantidad: prod.cantidad,
            cantidadInicial: prod.cantidad,
            costoTotal: prod.costoTotal,
            fechaIngreso: prod.fechaIngreso,
            fechaVencimiento: prod?.fechaExpiracion,
            precioCosto: prod.precioCosto,
            sucursal: { connect: { id: prod.sucursalId } },
            producto: { connect: { id: prod.productoId } },
            entregaStock: entregaStock
              ? { connect: { id: entregaStock.id } }
              : undefined,
            requisicionRecepcion: prod.requisicionRecepcionId
              ? { connect: { id: prod.requisicionRecepcionId } }
              : undefined,
          },
        }),
      ),
    );

    if (!newStocksCreated || newStocksCreated.length === 0) {
      throw new InternalServerErrorException({
        message: 'No se pudieron registrar los stocks',
      });
    }

    this.logger.debug('El nuevo registro de stock es: ', newStocksCreated);
    return { newStocksCreated, entregaStock }; // Retorna ambos registros
  }

  //crear stock de presentaciones
  async generateStockPresentacion(
    tx: Prisma.TransactionClient,
    dtos: Array<{
      productoId: number;
      presentacionId: number;
      sucursalId: number;
      cantidadPresentacion: number;
      fechaIngreso: Date;
      fechaVencimiento?: Date | null;
      requisicionRecepcionId?: number;
    }>,
  ) {
    this.logger.log('DTOS StockPresentacion -> ', dtos);
    if (!dtos.length) return [];

    const created = await Promise.all(
      dtos.map((sp) =>
        tx.stockPresentacion.create({
          data: {
            producto: { connect: { id: sp.productoId } },
            presentacion: { connect: { id: sp.presentacionId } },
            sucursal: { connect: { id: sp.sucursalId } },
            cantidadPresentacion: sp.cantidadPresentacion,
            cantidadRecibidaInicial: sp.cantidadPresentacion,
            fechaIngreso: sp.fechaIngreso,
            fechaVencimiento: sp.fechaVencimiento ?? null,
            requisicionRecepcion: sp.requisicionRecepcionId
              ? { connect: { id: sp.requisicionRecepcionId } }
              : undefined,
          },
        }),
      ),
    );

    if (!created.length) {
      throw new InternalServerErrorException(
        'No se pudieron registrar presentaciones',
      );
    }
    return created;
  }

  //SERVICIOS DE UTILIDADES PARA TRUNCAR MOVIMIENTOS MAYORES Y EVITAR CAJAS NEGATIVAS

  // Dentro de tu servicio de Caja
  async getCajaEstado(tx: Prisma.TransactionClient, registroCajaId: number) {
    const turno = await tx.registroCaja.findUnique({
      where: { id: registroCajaId },
      select: {
        id: true,
        estado: true,
        saldoInicial: true,
        fondoFijo: true,
        sucursalId: true,
      },
    });
    if (!turno || turno.estado !== EstadoTurnoCaja.ABIERTO) {
      throw new BadRequestException('Turno no encontrado o ya cerrado');
    }

    const agg = await tx.movimientoFinanciero.aggregate({
      _sum: { deltaCaja: true },
      where: { registroCajaId },
    });

    const saldoInicial = Number(turno.saldoInicial ?? 0);
    const fondoFijo = Number(turno.fondoFijo ?? 0);
    const deltaCajaAcum = Number(agg._sum.deltaCaja ?? 0);

    const enCaja = saldoInicial + deltaCajaAcum; // puede ser < 0 si hubo mal registro
    const enCajaOperable = Math.max(0, enCaja); // para límites
    const maxDeposito = Math.max(enCaja - fondoFijo, 0); // “depositar todo” respetando fondo

    return {
      turno,
      saldoInicial,
      fondoFijo,
      enCaja,
      enCajaOperable,
      maxDeposito,
    };
  }

  async validarMovimientoEfectivo(
    tx: Prisma.TransactionClient,
    registroCajaId: number,
    deltaCajaPropuesto: number,
  ) {
    const { enCaja } = await this.getCajaEstado(tx, registroCajaId);
    if (enCaja + deltaCajaPropuesto < 0) {
      // si es egreso (deltaCajaPropuesto < 0), calcula cuánto sí se puede
      const maxEgresoPosible = Math.max(enCaja, 0);
      throw new UnprocessableEntityException(
        `Efectivo insuficiente. Disponible: Q ${maxEgresoPosible.toFixed(2)}`,
      );
    }
  }

  async validarDepositoCierre(
    tx: Prisma.TransactionClient,
    registroCajaId: number,
    monto: number, // positivo
  ) {
    const { maxDeposito } = await this.getCajaEstado(tx, registroCajaId);
    if (monto > maxDeposito) {
      throw new UnprocessableEntityException(
        `Depósito excede el efectivo disponible. Máximo permitido: Q ${maxDeposito.toFixed(2)}`,
      );
    }
  }

  //ADICION DE STOCKS
}
