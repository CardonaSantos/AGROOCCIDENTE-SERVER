import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateInventarioPresentacionDto } from './dto/create-inventario-presentacion.dto';
import { UpdateInventarioPresentacionDto } from './dto/update-inventario-presentacion.dto';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class InventarioPresentacionService {
  constructor(private readonly prisma: PrismaService) {}

  async ingresarLote(
    tx,
    {
      productoId,
      presentacionId,
      sucursalId,
      cantPres,
      costoBase,
      fechaIngreso,
      fechaVencimiento,
    },
  ) {
    const pres = await tx.productoPresentacion.findUnique({
      where: { id: presentacionId },
      select: { factorUnidadBase: true, productoId: true },
    });
    if (!pres || pres.productoId !== productoId)
      throw new BadRequestException('Presentación inválida');

    const factor = pres.factorUnidadBase as Prisma.Decimal;
    const unidadesBase = factor.mul(cantPres);

    await tx.stockPresentacion.create({
      data: {
        productoId,
        presentacionId,
        sucursalId,
        cantidadPresentacion: cantPres,
        costoUnitarioBase: new Prisma.Decimal(costoBase),
        fechaIngreso: fechaIngreso ?? new Date(),
        fechaVencimiento: fechaVencimiento ?? null,
      },
    });

    await tx.stock.upsert({
      where: {
        /* tu unique de (productoId,sucursalId,fechaIngreso?) si la tienes */ id: 0,
      }, // ajusta a tu key
      update: { cantidad: { increment: Number(unidadesBase.toFixed(0)) } },
      create: {
        productoId,
        sucursalId,
        cantidad: Number(unidadesBase.toFixed(0)),
        fechaIngreso: fechaIngreso ?? new Date(),
        precioCosto: Number(new Prisma.Decimal(costoBase).toFixed(4)),
        costoTotal: 0,
      },
    });
  }

  async consumirFIFO(tx, { productoId, presentacionId, sucursalId, cantPres }) {
    const pres = await tx.productoPresentacion.findUnique({
      where: { id: presentacionId },
      select: { factorUnidadBase: true, productoId: true },
    });
    if (!pres || pres.productoId !== productoId)
      throw new BadRequestException('Presentación inválida');

    // 1) descontar presentaciones (FIFO por fechaIngreso)
    let restantePres = cantPres;
    const lotesPres = await tx.stockPresentacion.findMany({
      where: {
        productoId,
        presentacionId,
        sucursalId,
        cantidadPresentacion: { gt: 0 },
      },
      orderBy: { fechaIngreso: 'asc' },
    });
    for (const lote of lotesPres) {
      if (restantePres <= 0) break;
      const usar = Math.min(restantePres, lote.cantidadPresentacion);
      await tx.stockPresentacion.update({
        where: { id: lote.id },
        data: { cantidadPresentacion: { decrement: usar } },
      });
      restantePres -= usar;
    }
    if (restantePres > 0)
      throw new BadRequestException('Stock por presentación insuficiente');

    // 2) descontar stock agregado en unidades base
    const factor = pres.factorUnidadBase as Prisma.Decimal;
    let restanteBase = factor.mul(cantPres);

    const lotesBase = await tx.stock.findMany({
      where: { productoId, sucursalId, cantidad: { gt: 0 } },
      orderBy: { fechaIngreso: 'asc' },
    });
    for (const lote of lotesBase) {
      if (restanteBase.lte(0)) break;
      const disponible = new Prisma.Decimal(lote.cantidad);
      const usar = Prisma.Decimal.min(disponible, restanteBase);
      const usarInt = Number(usar.toFixed(0));
      if (usarInt > 0) {
        await tx.stock.update({
          where: { id: lote.id },
          data: { cantidad: { decrement: usarInt } },
        });
        restanteBase = restanteBase.sub(usar);
      }
    }
    if (restanteBase.gt(0))
      throw new BadRequestException('Stock agregado insuficiente');
  }
}
