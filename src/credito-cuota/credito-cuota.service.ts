import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { CreateCreditoCuotaDto } from './dto/create-credito-cuota.dto';
import { UpdateCreditoCuotaDto } from './dto/update-credito-cuota.dto';
import { CuotaEstado, CxPEstado } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class CreditoCuotaService {
  private readonly logger = new Logger(CreditoCuotaService.name);
  constructor(private readonly prisma: PrismaService) {}
  create(createCreditoCuotaDto: CreateCreditoCuotaDto) {
    return 'This action adds a new creditoCuota';
  }

  /**
   * Retorna CxPDocumentos en estado activo (PENDIENTE | PARCIAL)
   * con al menos una cuota pendiente (PENDIENTE | PARCIAL | VENCIDA).
   * Estructura de salida pensada para cards del dashboard.
   */
  async findActivosConCuotasPendientes() {
    try {
      const hoy = new Date();

      const documentos = await this.prisma.cxPDocumento.findMany({
        where: {
          estado: { in: ['PENDIENTE', 'PARCIAL'] as CxPEstado[] },
          cuotas: {
            some: {
              estado: {
                in: ['PENDIENTE', 'PARCIAL', 'VENCIDA'] as CuotaEstado[],
              },
            },
          },
        },
        include: {
          proveedor: { select: { id: true, nombre: true, rfc: true } },
          condicionPago: {
            select: {
              id: true,
              nombre: true,
              diasCredito: true,
              cantidadCuotas: true,
              diasEntreCuotas: true,
              interes: true,
              tipoInteres: true,
              modoGeneracion: true,
            },
          },
          cuotas: {
            where: {
              estado: {
                in: ['PENDIENTE', 'PARCIAL', 'VENCIDA'] as CuotaEstado[],
              },
            },
            orderBy: [{ fechaVencimiento: 'asc' }],
            select: {
              id: true,
              numero: true,
              fechaVencimiento: true,
              monto: true,
              saldo: true,
              estado: true,
            },
          },
        },
        orderBy: [{ fechaVencimiento: 'asc' }], // fecha del documento
      });

      const payload = documentos.map((doc) => {
        const cuotas = doc.cuotas.map((c) => {
          const vencida =
            c.estado === 'VENCIDA' ||
            (c.estado !== 'PAGADA' && c.fechaVencimiento < hoy);

          const diasRestantes = Math.floor(
            (new Date(c.fechaVencimiento).getTime() - hoy.getTime()) /
              (1000 * 60 * 60 * 24),
          );

          return {
            id: c.id,
            numero: c.numero,
            fechaVencimientoISO: c.fechaVencimiento.toISOString(),
            monto: c.monto.toString(),
            saldo: c.saldo.toString(),
            estado: c.estado as CuotaEstado,
            vencida,
            diasRestantes,
          };
        });

        const cuotasVencidas = cuotas.filter((q) => q.vencida);
        const proximaCuota = cuotas.find((q) => !q.vencida) ?? null;

        const totalAPagarHoy = cuotas
          .filter((q) => q.vencida || q.diasRestantes <= 0) // vencidas + vencen hoy
          .reduce((acc, q) => acc + Number(q.saldo), 0);

        return {
          documentoId: doc.id,
          proveedor: {
            id: doc.proveedor.id,
            nombre: doc.proveedor.nombre,
            rfc: doc.proveedor.rfc ?? null,
          },
          compra: doc.compraId ? { id: doc.compraId } : null,
          folioProveedor: doc.folioProveedor ?? null,
          fechaEmisionISO: doc.fechaEmision.toISOString(),
          fechaVencimientoISO: doc.fechaVencimiento?.toISOString() ?? null,
          estado: doc.estado as CxPEstado,
          montoOriginal: doc.montoOriginal.toString(),
          saldoPendiente: doc.saldoPendiente.toString(),
          condicionPago: doc.condicionPago
            ? {
                id: doc.condicionPago.id,
                nombre: doc.condicionPago.nombre,
                diasCredito: doc.condicionPago.diasCredito ?? null,
                cantidadCuotas: doc.condicionPago.cantidadCuotas ?? null,
                diasEntreCuotas: doc.condicionPago.diasEntreCuotas ?? null,
                interes: doc.condicionPago.interes?.toString() ?? null,
                tipoInteres: doc.condicionPago.tipoInteres,
                modoGeneracion: doc.condicionPago.modoGeneracion,
              }
            : null,
          // métricas para cards
          cuotasPendientes: cuotas.length,
          cuotasVencidas: cuotasVencidas.length,
          totalAPagarHoy: totalAPagarHoy.toFixed(2), // string
          proximaCuota, // null si todas vencidas
          cuotas, // detalle de cuotas pendientes
        };
      });

      return { data: payload };
    } catch (error) {
      // log y manejo
      throw new InternalServerErrorException(
        'Error al obtener créditos activos con cuotas pendientes',
      );
    }
  }

  findAll() {
    return `This action returns all creditoCuota`;
  }

  findOne(id: number) {
    return `This action returns a #${id} creditoCuota`;
  }

  update(id: number, updateCreditoCuotaDto: UpdateCreditoCuotaDto) {
    return `This action updates a #${id} creditoCuota`;
  }

  remove(id: number) {
    return `This action removes a #${id} creditoCuota`;
  }
}
