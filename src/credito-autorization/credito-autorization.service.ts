import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateCreditoAutorizationDto } from './dto/create-credito-autorization.dto';
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
   * @returns crea el registro de autorizacion, y envía por notifiacion a administradores
   */
  async create(dto: CreateCreditoAutorizationDto) {
    try {
      verifyProps<CreateCreditoAutorizationDto>(dto, [
        'sucursalId',
        'solicitadoPorId',
      ]);

      const {
        aprobadoPorId,
        clienteId,
        comentario,
        cuotaInicialPropuesta,
        cuotasTotalesPropuestas,
        diasEntrePagos,
        estado,
        fechaPrimeraCuota,
        fechaRespuesta,
        interesPorcentaje,
        interesTipo,
        lineas,
        motivoRechazo,
        planCuotaModo,
        solicitadoPorId,
        sucursalId,
        totalPropuesto,
        ventaId,
      } = dto;

      this.logger.log(
        `DTO recibido en create autorizacion:\n${JSON.stringify(dto, null, 2)}`,
      );

      const today = dayjs().tz(TZGT);

      const newAutorizacion = await this.prisma.$transaction(async (tx) => {
        const autorization = await tx.solicitudCreditoVenta.create({
          data: {
            cliente: {
              connect: {
                id: clienteId,
              },
            },
            solicitadoPor: {
              connect: {
                id: solicitadoPorId,
              },
            },
            sucursal: {
              connect: {
                id: sucursalId,
              },
            },
            comentario: comentario,
            estado: 'PENDIENTE',
            totalPropuesto: totalPropuesto,
            cuotasTotalesPropuestas: cuotasTotalesPropuestas,
            diasEntrePagos: diasEntrePagos,
            fechaPrimeraCuota: fechaPrimeraCuota
              ? dayjs(fechaPrimeraCuota).toDate()
              : today.toDate(),
            interesTipo: interesTipo,
            interesPorcentaje: interesPorcentaje,
            planCuotaModo: planCuotaModo,
          },
        });

        this.logger.log('La cabecera de autorizacion es: ', autorization);

        const lineasAutorizacion = await Promise.all(
          lineas.map((l) => {
            tx.solicitudCreditoVentaLinea.create({
              data: {
                cantidad: l.cantidad,
                precioUnitario: l.precioUnitario,
                subtotal: l.subtotal,
                precioListaRef: l.precioListaRef,
                solicitud: {
                  connect: {
                    id: autorization.id,
                  },
                },
                producto: l.productoId
                  ? {
                      connect: {
                        id: l.productoId,
                      },
                    }
                  : {},
                presentacion: l.presentacionId
                  ? {
                      connect: {
                        id: l.presentacionId,
                      },
                    }
                  : {},
              },
            });
          }),
        );
        this.logger.log('La cabecera de autorizacion es: ', lineasAutorizacion);
      });
      return newAutorizacion;
    } catch (error) {
      this.logger.error('Error en modulo crear autorizacion: ', error?.stack);
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'Fatal error: Error inesperado en módulo autorizacion',
      );
    }
  }

  /**
   * GET: En desarrollo para retornar las autorizaciones en el dashboard o como historial
   */
  async getAutorizaciones() {
    try {
      const records = await this.prisma.solicitudCreditoVenta.findMany({
        select: selectCreditAutorization,
        where: {}, //el where lo cambiaremos para pendientes y otros en otro caso
      });

      if (!records)
        throw new NotFoundException(
          'No se encontraron registros de autorizaciones',
        );
      return records;
    } catch (error) {
      this.logger.error('Error en modulo crear autorizacion: ', error?.stack);
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'Fatal error: Error inesperado en módulo autorizacion',
      );
    }
  }
}
