import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateCuotaDto } from './dto/create-cuota.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateVentaCuotaDto } from './dto/update-cuota.dto';
import {
  CreateVentaCuotaDto,
  ProductsList,
  Tipo,
} from './dto/create-ventacuota.dto';
import { CreatePlantillaComprobanteDto } from './dto/plantilla-comprobante.dt';
import { CuotaDto } from './dto/registerNewPay';
import { CloseCreditDTO } from './dto/close-credit.dto';
import { CreditoRegistro, Testigo } from './TypeCredit';
import { DeleteOneRegistCreditDto } from './dto/delete-one-regist.dto';

import * as bcrypt from 'bcryptjs';
import * as dayjs from 'dayjs';
import { DeleteCuotaPaymentDTO } from './dto/delete-one-payment-cuota.dto';
import { TZGT } from 'src/utils/utils';
import { CajaService } from 'src/caja/caja.service';

// Líneas separadas con tipo firme
type LineaProducto = {
  tipo: Tipo.PRODUCTO;
  productoId: number;
  cantidad: number;
  precioVenta?: number;
};

type LineaPresentacion = {
  tipo: Tipo.PRESENTACION;
  productoId: number; // sigue siendo útil para validaciones
  presentacionId: number; // CLAVE para agrupar/stock
  cantidad: number;
  precioVenta?: number;
};

// Para updates de stock
type StockUpdate = { id: number; cantidad: number };
@Injectable()
export class CuotasService {
  private readonly logger = new Logger(CuotasService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly cajaService: CajaService,
  ) {}

  async create(createVentaCuotaDto: CreateVentaCuotaDto) {
    try {
      const {
        productos,
        clienteId,
        cuotaInicial,
        diasEntrePagos,
        montoVenta, // viene del front; podemos ignorarlo si calculamos todo
        sucursalId,
        totalVenta, // idem
        usuarioId,
        fechaContrato,
        fechaInicio,
        garantiaMeses,
        cuotasTotales,
        interes,
        montoTotalConInteres,
      } = createVentaCuotaDto;

      this.logger.log(
        'Payload Crédito -> ' + JSON.stringify(createVentaCuotaDto),
      );

      // === 1) Normalización de fechas
      const fechaInicioDate = dayjs(fechaInicio)
        .tz(TZGT)
        .startOf('day')
        .toDate();
      const fechaContratoDate = fechaContrato
        ? dayjs(fechaContrato).tz(TZGT).startOf('day').toDate()
        : fechaInicioDate;

      // === 2) Partición tipada de líneas
      const productosLineas: LineaProducto[] = productos
        .filter(
          (p): p is ProductsList & { tipo: Tipo.PRODUCTO } =>
            p.tipo === Tipo.PRODUCTO && !!p.productoId,
        )
        .map((p) => ({
          tipo: Tipo.PRODUCTO,
          productoId: p.productoId!,
          cantidad: p.cantidad,
          precioVenta: p.precioVenta,
        }));

      const presentacionesLineas: LineaPresentacion[] = productos
        .filter(
          (p): p is ProductsList & { tipo: Tipo.PRESENTACION } =>
            p.tipo === Tipo.PRESENTACION && !!p.presentacionId,
        )
        .map((p) => ({
          tipo: Tipo.PRESENTACION,
          productoId: p.productoId!,
          presentacionId: p.presentacionId!,
          cantidad: p.cantidad,
          precioVenta: p.precioVenta,
        }));

      // === 3) Consolidación (para no duplicar items)
      const productosConsolidados = productosLineas.reduce<LineaProducto[]>(
        (acc, curr) => {
          const i = acc.findIndex((x) => x.productoId === curr.productoId);
          if (i >= 0) acc[i].cantidad += curr.cantidad;
          else acc.push({ ...curr });
          return acc;
        },
        [],
      );

      const presentacionesConsolidadas = presentacionesLineas.reduce<
        LineaPresentacion[]
      >((acc, curr) => {
        const i = acc.findIndex(
          (x) => x.presentacionId === curr.presentacionId,
        );
        if (i >= 0) acc[i].cantidad += curr.cantidad;
        else acc.push({ ...curr });
        return acc;
      }, []);

      this.logger.log(
        'Productos consolidados: ' +
          JSON.stringify(productosConsolidados, null, 2),
      );
      this.logger.log(
        'Presentaciones consolidadas: ' +
          JSON.stringify(presentacionesConsolidadas, null, 2),
      );

      // === 4) Totales (lado servidor)
      const totalVentaCalculado =
        productosConsolidados.reduce(
          (acc, p) => acc + p.cantidad * (p.precioVenta ?? 0),
          0,
        ) +
        presentacionesConsolidadas.reduce(
          (acc, pr) => acc + pr.cantidad * (pr.precioVenta ?? 0),
          0,
        );

      const montoTotalConInteresFinal =
        montoTotalConInteres != null
          ? Number(montoTotalConInteres)
          : +(totalVentaCalculado * (1 + Number(interes ?? 0) / 100)).toFixed(
              2,
            );

      // === 5) Validaciones numéricas
      if (montoTotalConInteresFinal < 0)
        throw new BadRequestException(
          'montoTotalConInteres no puede ser negativo.',
        );
      if (cuotaInicial < 0)
        throw new BadRequestException(
          'La cuota inicial no puede ser negativa.',
        );
      if (cuotasTotales <= 0)
        throw new BadRequestException('cuotasTotales debe ser mayor que 0.');
      if (cuotaInicial > montoTotalConInteresFinal) {
        throw new BadRequestException(
          'La cuota inicial no puede ser mayor que el monto total con interés.',
        );
      }

      // === 6) Verificación de stock (preparamos “updates”)
      const stockUpdates: StockUpdate[] = [];
      for (const prod of productosConsolidados) {
        const stocks = await this.prisma.stock.findMany({
          where: { productoId: prod.productoId, sucursalId },
          orderBy: { fechaIngreso: 'asc' },
        });
        let restante = prod.cantidad;
        for (const st of stocks) {
          if (restante <= 0) break;
          if (st.cantidad >= restante) {
            stockUpdates.push({ id: st.id, cantidad: st.cantidad - restante });
            restante = 0;
          } else {
            stockUpdates.push({ id: st.id, cantidad: 0 });
            restante -= st.cantidad;
          }
        }
        if (restante > 0)
          throw new Error(
            `No hay suficiente stock para el producto ${prod.productoId}`,
          );
      }

      const stockUpdatesPresentaciones: StockUpdate[] = [];
      for (const pres of presentacionesConsolidadas) {
        const stocks = await this.prisma.stockPresentacion.findMany({
          where: { presentacionId: pres.presentacionId, sucursalId },
          orderBy: { fechaIngreso: 'asc' },
        });
        let restante = pres.cantidad;
        for (const st of stocks) {
          if (restante <= 0) break;
          if (st.cantidadPresentacion >= restante) {
            stockUpdatesPresentaciones.push({
              id: st.id,
              cantidad: st.cantidadPresentacion - restante,
            });
            restante = 0;
          } else {
            stockUpdatesPresentaciones.push({ id: st.id, cantidad: 0 });
            restante -= st.cantidadPresentacion;
          }
        }
        if (restante > 0)
          throw new Error(
            `No hay suficiente stock para la presentación ${pres.presentacionId}`,
          );
      }

      this.logger.log(
        'Updates stock pres -> ' +
          JSON.stringify(stockUpdatesPresentaciones, null, 2),
      );

      // === 7) Transacción: descuenta stock + crea venta/pago + ventaCuota + cuotas
      const ventaCuota = await this.prisma.$transaction(async (tx) => {
        // 7.1 Stock
        for (const u of stockUpdates) {
          await tx.stock.update({
            where: { id: u.id },
            data: { cantidad: u.cantidad },
          });
        }
        for (const u of stockUpdatesPresentaciones) {
          await tx.stockPresentacion.update({
            where: { id: u.id },
            data: { cantidadPresentacion: u.cantidad },
          });
        }

        // 7.2 Venta
        const venta = await tx.venta.create({
          data: {
            clienteId: Number(clienteId),
            sucursalId: Number(sucursalId),
            totalVenta: Number(totalVentaCalculado),
            productos: {
              create: [
                ...productosConsolidados.map((p) => ({
                  producto: { connect: { id: p.productoId } },
                  cantidad: p.cantidad,
                  precioVenta: Number(p.precioVenta ?? 0),
                })),
                ...presentacionesConsolidadas.map((pr) => ({
                  presentacion: { connect: { id: pr.presentacionId } },
                  cantidad: pr.cantidad,
                  precioVenta: Number(pr.precioVenta ?? 0),
                })),
              ],
            },
          },
        });

        // 7.3 Pago inicial
        await tx.pago.create({
          data: {
            ventaId: venta.id,
            monto: Number(cuotaInicial),
            metodoPago: 'CREDITO',
            fechaPago: new Date(),
          },
        });

        // 7.4 Venta a crédito
        const vc = await tx.ventaCuota.create({
          data: {
            totalVenta: Number(totalVentaCalculado),
            montoVenta: Number(totalVentaCalculado),
            montoTotalConInteres: Number(montoTotalConInteresFinal),

            cuotaInicial: Number(cuotaInicial),
            cuotasTotales: Number(cuotasTotales),
            diasEntrePagos: Number(diasEntrePagos),
            interes: Number(interes ?? 0),
            totalPagado: Number(cuotaInicial),

            estado: 'ACTIVA',
            fechaInicio: fechaInicioDate,
            fechaContrato: fechaContratoDate,
            garantiaMeses: Number(garantiaMeses ?? 0),

            comentario: '',
            dpi: '',
            testigos: {},

            venta: { connect: { id: venta.id } },
            cliente: {
              connect: {
                id: clienteId,
              },
            },
            sucursal: {
              connect: {
                id: sucursalId,
              },
            },
            usuario: {
              connect: {
                id: usuarioId,
              },
            },
          },
        });

        // 7.5 Cuotas (reparto de centavos para evitar drift)
        const baseCents = Math.max(
          0,
          Math.round((montoTotalConInteresFinal - cuotaInicial) * 100),
        );
        const cuotaBaseCents = Math.floor(baseCents / cuotasTotales);
        const resto = baseCents - cuotaBaseCents * cuotasTotales;

        for (let i = 0; i < cuotasTotales; i++) {
          const cents = cuotaBaseCents + (i < resto ? 1 : 0);
          await tx.cuota.create({
            data: {
              ventaCuotaId: vc.id,
              montoEsperado: cents / 100,
              fechaVencimiento: dayjs(fechaInicioDate)
                .tz(TZGT)
                .add(diasEntrePagos * (i + 1), 'day')
                .toDate(),
              estado: 'PENDIENTE',
              monto: 0,
            },
          });
        }
        await this.cajaService.attachAndRecordSaleTx(
          tx,
          venta.id,
          sucursalId,
          usuarioId,
          { exigirCajaSiEfectivo: true },
        );

        return vc;
      });

      this.logger.debug(`[CRED] totalVentaCalculado=${totalVentaCalculado}`);
      this.logger.debug(
        `[CRED] montoTotalConInteresFinal=${montoTotalConInteresFinal}`,
      );
      const base = +(montoTotalConInteresFinal - cuotaInicial).toFixed(2);
      const montoPorCuota = +(base / cuotasTotales).toFixed(2);
      this.logger.debug(
        `[CRED] cuotaInicial=${cuotaInicial}, base=${base}, cuotas=${cuotasTotales}, montoPorCuota≈${montoPorCuota}`,
      );

      return ventaCuota;
    } catch (err) {
      this.logger.error(err);
      throw new BadRequestException('Error al crear el registro de crédito');
    }
  }

  async createPlantilla(
    createPlantillaComprobanteDto: CreatePlantillaComprobanteDto,
  ) {
    try {
      const plantilla = await this.prisma.plantillaComprobante.create({
        data: {
          nombre: createPlantillaComprobanteDto.nombre,
          texto: createPlantillaComprobanteDto.texto,
          sucursalId: createPlantillaComprobanteDto.sucursalId || null,
        },
      });
      return plantilla;
    } catch (error) {
      console.log(error);
      throw new BadRequestException('Error');
    }
  }

  async registerNewPay(createCuotaDto: CuotaDto) {
    try {
      // 1. Update the cuota (payment) record
      const cuotaA_Actualizar = await this.prisma.cuota.update({
        where: { id: createCuotaDto.ventaCuotaId },
        data: {
          monto: createCuotaDto.monto,
          estado: createCuotaDto.estado,
          usuarioId: createCuotaDto.usuarioId,
          comentario: createCuotaDto.comentario,
          fechaPago: new Date(),
        },
      });

      // 2. Update the total paid in VentaCuota
      const ventaCuotaActualizada = await this.prisma.ventaCuota.update({
        where: { id: createCuotaDto.CreditoID },
        data: {
          totalPagado: { increment: createCuotaDto.monto },
        },
        include: { venta: true },
      });

      if (!ventaCuotaActualizada) {
        throw new NotFoundException('Registro no encontrado');
      }

      // 3. Update the totalVenta in the associated Venta (if exists)
      if (ventaCuotaActualizada.venta) {
        await this.prisma.venta.update({
          where: { id: ventaCuotaActualizada.venta.id },
          data: {
            totalVenta: { increment: createCuotaDto.monto },
          },
        });
      }

      // 4. Search for the most recent active meta for the user
      let metaMasReciente = await this.prisma.metaUsuario.findFirst({
        where: {
          usuarioId: Number(createCuotaDto.usuarioId),
          estado: { in: ['ABIERTO', 'FINALIZADO'] },
        },
        orderBy: { fechaInicio: 'desc' },
      });

      // If a meta is found, update its montoActual
      if (metaMasReciente) {
        const metaTienda = await this.prisma.metaUsuario.update({
          where: {
            id: metaMasReciente.id,
            estado: { in: ['ABIERTO', 'FINALIZADO'] },
          },
          data: { montoActual: { increment: createCuotaDto.monto } },
        });

        const metaActualizada = await this.prisma.metaUsuario.findUnique({
          where: { id: metaMasReciente.id },
        });

        if (metaActualizada.montoActual >= metaActualizada.montoMeta) {
          await this.prisma.metaUsuario.update({
            where: { id: metaActualizada.id },
            data: {
              cumplida: true,
              estado: 'FINALIZADO',
              fechaCumplida: new Date(),
            },
          });
        }
        console.log(
          'El registro de meta de tienda actualizado es: ',
          metaTienda,
        );
      } else {
        console.warn(
          `No se encontró ninguna meta activa para el usuario con ID ${createCuotaDto.usuarioId}`,
        );
        // Continue normally without updating any meta
      }

      return cuotaA_Actualizar;
    } catch (error) {
      console.error('Error en registerNewPay:', error);
      throw new BadRequestException('Error al registrar pago de cuota');
    }
  }

  async getCredutsWithoutPaying() {
    const credits = await this.prisma.ventaCuota.findMany({
      where: {
        estado: {
          notIn: ['CANCELADA', 'COMPLETADA'],
        },
      },
      orderBy: {
        creadoEn: 'desc',
      },
      include: {
        cuotas: {
          select: {
            id: true,
            creadoEn: true,
            estado: true,
            monto: true,
            fechaPago: true,
            fechaVencimiento: true,
          },
        },
        cliente: {
          select: {
            id: true,
            nombre: true,
          },
        },

        sucursal: {
          select: {
            id: true,
            nombre: true,
            direccion: true,
          },
        },
        usuario: {
          select: {
            id: true,
            nombre: true,
          },
        },
      },
    });
    return credits;
  }

  async getPlantillas() {
    try {
      const plantillas = await this.prisma.plantillaComprobante.findMany({
        orderBy: {
          creadoEn: 'desc',
        },
      });
      return plantillas;
    } catch (error) {
      console.log(error);
      throw new BadRequestException('Error al conseguir la plantilla');
    }
  }

  async getAllCredits(): Promise<CreditoRegistro[]> {
    try {
      const credits = await this.prisma.ventaCuota.findMany({
        orderBy: {
          creadoEn: 'desc',
        },
        include: {
          cliente: {
            select: {
              id: true,
              nombre: true,
              telefono: true,
              direccion: true,
              dpi: true,
            },
          },
          sucursal: {
            select: {
              id: true,
              nombre: true,
              direccion: true,
            },
          },
          usuario: {
            select: {
              id: true,
              nombre: true,
            },
          },
          cuotas: {
            select: {
              id: true,
              creadoEn: true,
              estado: true,
              fechaPago: true,
              monto: true,
              comentario: true,
              usuario: {
                select: {
                  id: true,
                  nombre: true,
                },
              },
            },
          },
          venta: {
            include: {
              productos: {
                include: {
                  producto: {
                    select: {
                      id: true,
                      nombre: true,
                      codigoProducto: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      // Transformar los datos
      const formattedCredits: CreditoRegistro[] = credits.map((credit) => ({
        id: credit.id,
        clienteId: credit.clienteId,
        usuarioId: credit.usuarioId,
        sucursalId: credit.sucursalId,
        totalVenta: credit.totalVenta,
        cuotaInicial: credit.cuotaInicial,
        cuotasTotales: credit.cuotasTotales,
        fechaInicio: credit.fechaInicio.toISOString(),
        estado: credit.estado,
        creadoEn: credit.creadoEn.toISOString(),
        actualizadoEn: credit.actualizadoEn.toISOString(),
        dpi: credit.cliente.dpi,
        testigos: Array.isArray(credit.testigos)
          ? (credit.testigos as unknown as Testigo[])
          : [],
        fechaContrato: credit.fechaContrato.toISOString(),
        montoVenta: credit.montoVenta,
        garantiaMeses: credit.garantiaMeses,
        totalPagado: credit.totalPagado,
        cliente: credit.cliente,
        productos:
          credit.venta?.productos.map((vp) => ({
            id: vp.id,
            ventaId: vp.ventaId,
            productoId: vp.productoId,
            cantidad: vp.cantidad,
            creadoEn: vp.creadoEn.toISOString(),
            precioVenta: vp.precioVenta,
            producto: {
              id: vp.producto.id,
              nombre: vp.producto.nombre,
              codigoProducto: vp.producto.codigoProducto,
            },
          })) || [],
        sucursal: credit.sucursal,
        usuario: credit.usuario,
        cuotas: credit.cuotas.map((cuota) => ({
          id: cuota.id,
          creadoEn: cuota.creadoEn.toISOString(),
          estado: cuota.estado,
          fechaPago: cuota.fechaPago?.toISOString() || null,
          monto: cuota.monto,
          comentario: cuota.comentario,
          usuario: cuota.usuario
            ? {
                id: cuota.usuario.id,
                nombre: cuota.usuario.nombre,
              }
            : null,
        })),
        diasEntrePagos: credit.diasEntrePagos,
        interes: credit.interes,
        comentario: credit.comentario,
        montoTotalConInteres: credit.montoTotalConInteres,
      }));

      return formattedCredits;
    } catch (error) {
      console.error(error);
      throw new BadRequestException('Error al recuperar los créditos');
    }
  }

  async getPlantilla(id: number) {
    try {
      const plantilla = await this.prisma.plantillaComprobante.findUnique({
        where: {
          id,
        },
      });
      return plantilla.texto;
    } catch (error) {
      console.log(error);
      throw new BadRequestException('Error al conseguir la plantilla');
    }
  }

  async getPlantillaToEdit(id: number) {
    try {
      const plantilla = await this.prisma.plantillaComprobante.findUnique({
        where: {
          id,
        },
      });
      return plantilla;
    } catch (error) {
      console.log(error);
      throw new BadRequestException('Error al conseguir la plantilla');
    }
  }

  async getCuota(id: number): Promise<{
    id: number;
    fechaContrato: string;
    cliente: {
      id: number;
      nombre: string;
      telefono: string;
      direccion: string;
      dpi: string;
    };
    usuario: {
      id: number;
      nombre: string;
    };
    testigos: {
      nombre: string;
      telefono: string;
      direccion: string;
    }[];
    sucursal: {
      id: number;
      nombre: string;
      direccion: string;
    };
    productos: {
      id: number;
      ventaId: number;
      productoId: number;
      cantidad: number;
      creadoEn: string;
      precioVenta: number;
      producto: {
        id: number;
        nombre: string;
        codigoProducto: string;
      };
    }[];
    montoVenta: number;
    cuotaInicial: number;
    cuotasTotales: number;
    garantiaMeses: number;
    dpi: string;
    diasEntrePagos: number;
    interes: number;
    totalVenta: number;
    montoTotalConInteres: number;
    totalPagado: number;
  }> {
    try {
      const cuota = await this.prisma.ventaCuota.findUnique({
        where: {
          id,
        },
        include: {
          cliente: {
            select: {
              id: true,
              nombre: true,
              telefono: true,
              direccion: true,
              dpi: true,
            },
          },
          sucursal: {
            select: {
              id: true,
              nombre: true,
              direccion: true,
            },
          },
          usuario: {
            select: {
              id: true,
              nombre: true,
            },
          },
          venta: {
            include: {
              productos: {
                include: {
                  producto: {
                    select: {
                      id: true,
                      nombre: true,
                      codigoProducto: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!cuota) {
        throw new Error('No se encontró la cuota solicitada');
      }

      return {
        id: cuota.id,
        fechaContrato: cuota.fechaContrato.toISOString(),
        cliente: {
          id: cuota.cliente.id,
          nombre: cuota.cliente.nombre,
          telefono: cuota.cliente.telefono,
          direccion: cuota.cliente.direccion,
          dpi: cuota.cliente.dpi,
        },
        usuario: {
          id: cuota.usuario.id,
          nombre: cuota.usuario.nombre,
        },
        testigos: Array.isArray(cuota.testigos)
          ? (cuota.testigos as {
              nombre: string;
              telefono: string;
              direccion: string;
            }[])
          : [],
        sucursal: {
          id: cuota.sucursal.id,
          nombre: cuota.sucursal.nombre,
          direccion: cuota.sucursal.direccion,
        },
        productos:
          cuota.venta?.productos.map((vp) => ({
            id: vp.id,
            ventaId: vp.ventaId,
            productoId: vp.productoId,
            cantidad: vp.cantidad,
            creadoEn: vp.creadoEn.toISOString(),
            precioVenta: vp.precioVenta,
            producto: {
              id: vp.producto.id,
              nombre: vp.producto.nombre,
              codigoProducto: vp.producto.codigoProducto,
            },
          })) || [],
        montoVenta: cuota.montoVenta,
        cuotaInicial: cuota.cuotaInicial,
        cuotasTotales: cuota.cuotasTotales,
        garantiaMeses: cuota.garantiaMeses,
        dpi: cuota.dpi,
        diasEntrePagos: cuota.diasEntrePagos,
        interes: cuota.interes,
        totalVenta: cuota.totalVenta,
        montoTotalConInteres: cuota.montoTotalConInteres,
        totalPagado: cuota.totalPagado,
      };
    } catch (error) {
      console.error(error);
      throw new BadRequestException('Error al recuperar los datos de la cuota');
    }
  }

  async deleteAll() {
    try {
      const regists = await this.prisma.ventaCuota.deleteMany({});
      return regists;
    } catch (error) {
      console.log(error);

      throw new BadRequestException('Error');
    }
  }

  async deleteAllPlantillas() {
    try {
      const regists = await this.prisma.plantillaComprobante.deleteMany({});
      return regists;
    } catch (error) {
      console.log(error);

      throw new BadRequestException('Error');
    }
  }

  async deleteOnePlaceholder(id: number) {
    try {
      const response = await this.prisma.plantillaComprobante.delete({
        where: {
          id,
        },
      });
      return response;
    } catch (error) {
      console.log(error);
      throw new BadRequestException('Error al eliminar registro');
    }
  }

  async updatePlantilla(
    id: number,
    createPlantillaComprobanteDto: CreatePlantillaComprobanteDto,
  ) {
    console.log('los datos son: ', createPlantillaComprobanteDto);

    try {
      const placeholderToUpdate = await this.prisma.plantillaComprobante.update(
        {
          where: {
            id,
          },
          data: {
            nombre: createPlantillaComprobanteDto.nombre,
            texto: createPlantillaComprobanteDto.texto,
          },
        },
      );

      return placeholderToUpdate;
    } catch (error) {
      console.log(error);
      throw new BadRequestException('Error al actualizar registro');
    }
  }

  async closeCreditRegist(id: number, closeCreditDto: CloseCreditDTO) {
    try {
      const creditToClose = await this.prisma.ventaCuota.update({
        where: {
          id,
        },
        data: {
          estado: closeCreditDto.estado,
          comentario: closeCreditDto.comentario,
        },
      });
      return creditToClose;
    } catch (error) {
      console.log(error);
      throw new BadRequestException('Error al actualizar y cerrar credito');
    }
  }

  async getComprobanteCuota(id: number): Promise<any> {
    try {
      const cuota = await this.prisma.cuota.findUnique({
        where: {
          id,
        },
        select: {
          id: true,
          monto: true,
          fechaPago: true,
          estado: true,
          comentario: true,
          usuario: {
            select: {
              id: true,
              nombre: true,
              rol: true,
            },
          },
          ventaCuota: {
            select: {
              cliente: {
                select: {
                  id: true,
                  nombre: true,
                  dpi: true,
                },
              },
              venta: {
                select: {
                  productos: {
                    select: {
                      producto: {
                        select: {
                          id: true,
                          nombre: true,
                          descripcion: true,
                          codigoProducto: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!cuota) {
        throw new BadRequestException('Cuota no encontrada');
      }

      // Transformar los datos para facilitar su uso en el front
      return {
        id: cuota.id,
        monto: cuota.monto,
        fechaPago: cuota.fechaPago,
        estado: cuota.estado,
        comentario: cuota.comentario,
        usuario: cuota.usuario,
        cliente: cuota.ventaCuota?.cliente,
        productos:
          cuota.ventaCuota?.venta?.productos.map((p) => ({
            id: p.producto.id,
            nombre: p.producto.nombre,
            descripcion: p.producto.descripcion,
            codigoProducto: p.producto.codigoProducto,
          })) || [],
      };
    } catch (error) {
      console.error('Error al conseguir comprobante de cuota', error);
      throw new BadRequestException('Error al conseguir comprobante');
    }
  }

  async deleteAllCreditosPrueba() {
    try {
      const registrosEliminados = await this.prisma.ventaCuota.deleteMany({});
      return registrosEliminados;
    } catch (error) {
      console.log(error);
      throw new BadRequestException('Error al eliminar');
    }
  }

  async deleteOneCreditRegist(deleteOneCreditDto: DeleteOneRegistCreditDto) {
    console.log('Entrando a la eliminación de registro de crédito');
    console.log('Datos recibidos:', deleteOneCreditDto);

    const { creditId, passwordAdmin, sucursalId, userId } = deleteOneCreditDto;
    console.log('El id de la sucursal es: ', sucursalId);

    try {
      const userAdmin = await this.prisma.usuario.findUnique({
        where: { id: userId },
        select: { rol: true, contrasena: true },
      });

      if (!userAdmin) {
        throw new NotFoundException('Usuario administrador no encontrado');
      }

      if (!['ADMIN', 'SUPER_ADMIN'].includes(userAdmin.rol)) {
        throw new UnauthorizedException('El usuario no es administrador');
      }

      const isValidPassword = await bcrypt.compare(
        passwordAdmin,
        userAdmin.contrasena,
      );
      if (!isValidPassword) {
        throw new UnauthorizedException('Contraseña incorrecta');
      }

      const sucursal = await this.prisma.sucursal.findUnique({
        where: { id: sucursalId },
      });

      if (!sucursal) {
        throw new NotFoundException('Sucursal no encontrada');
      }

      const creditToDelete = await this.prisma.ventaCuota.findUnique({
        where: { id: creditId },
        include: {
          venta: {
            select: {
              id: true,
            },
          },
        },
      });

      if (!creditToDelete) {
        throw new NotFoundException('No se encontró el registro de crédito');
      }

      // Obtener todas las cuotas asociadas
      const cuotas = await this.prisma.cuota.findMany({
        where: { ventaCuotaId: creditId },
      });

      const total = cuotas.reduce(
        (acc, c) => acc + c.monto,
        creditToDelete.cuotaInicial,
      );
      console.log('El total de todas las cuotas es:', total);

      await this.prisma.cuota.deleteMany({
        where: { ventaCuotaId: creditId },
      });

      await this.prisma.ventaCuota.delete({
        where: { id: creditId },
      });

      const ventaToDelete = await this.prisma.venta.findUnique({
        where: {
          id: creditToDelete.venta.id,
        },
      });

      if (!ventaToDelete) {
        throw new NotFoundException('Venta no encontrada, error');
      }

      await this.prisma.venta.delete({
        where: {
          id: ventaToDelete.id,
        },
      });

      console.log('La venta a eliminar es: ', ventaToDelete);

      console.log('Crédito eliminado correctamente');

      // const creditosActualizados = await this.getAllCredits();

      return;
    } catch (error) {
      console.error('Error al eliminar crédito:', error);

      if (
        error instanceof NotFoundException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }

      throw new InternalServerErrorException('Ocurrió un error inesperado');
    }
  }

  async deleteOnePaymentCuota(deleteOnePayment: DeleteCuotaPaymentDTO) {
    // Buscar al usuario y verificar su rol y contraseña
    const userAdmin = await this.prisma.usuario.findUnique({
      where: { id: deleteOnePayment.userId },
      select: { contrasena: true, rol: true },
    });

    const validPassword = await bcrypt.compare(
      deleteOnePayment.password,
      userAdmin?.contrasena || '',
    );

    if (!['ADMIN', 'SUPER_ADMIN'].includes(userAdmin?.rol) || !validPassword) {
      throw new UnauthorizedException('No tienes permisos para esta acción.');
    }

    return await this.prisma.$transaction(async (prisma) => {
      // Buscar la cuota y su relación con el crédito y la venta
      const cuota = await prisma.cuota.findUnique({
        where: { id: deleteOnePayment.cuotaID },
        include: {
          ventaCuota: {
            include: {
              venta: true,
            },
          },
        },
      });

      if (!cuota) throw new NotFoundException('Error al encontrar la cuota.');

      const { monto, ventaCuota } = cuota;
      console.log('EL monto pagado que borraremos es: ', monto);

      const { id: ventaCuotaId, totalPagado, venta } = ventaCuota;

      if (!venta) {
        throw new NotFoundException(
          'No se encontró la venta asociada al crédito.',
        );
      }

      if (!cuota.fechaPago || cuota.monto === 0) {
        throw new BadRequestException(
          'Esta cuota ya ha sido modificada o no ha sido pagada.',
        );
      }

      // Nuevo total pagado de la ventaCuota
      const nuevoTotalPagado = totalPagado - monto;

      // Nuevo total en la venta asociada al crédito, aqui para poder reasingnar en lugar de solo quitar o restarle al monto pagado, asi verificaremos sino es negativo abajo
      const nuevoTotalVenta = venta.totalVenta - monto;

      if (nuevoTotalPagado < 0 || nuevoTotalVenta < 0) {
        throw new BadRequestException(
          'El ajuste excede el total pagado o el total de la venta.',
        );
      }

      await prisma.cuota.update({
        where: { id: cuota.id },
        data: {
          fechaPago: null,
          monto: 0,
          estado: 'PENDIENTE',
          comentario: null,
        },
      });

      // Actualizar la ventaCuota restando el monto de la cuota eliminada
      await prisma.ventaCuota.update({
        where: { id: ventaCuotaId },
        data: {
          totalPagado: nuevoTotalPagado,
        },
      });

      // Actualizar la venta asociada al crédito
      await prisma.venta.update({
        where: { id: venta.id },
        data: {
          totalVenta: nuevoTotalVenta,
        },
      });

      return {
        message:
          'Pago eliminado correctamente y datos actualizados en todas las entidades.',
      };
    });
  }
}
