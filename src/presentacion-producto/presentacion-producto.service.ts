import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreatePresentacionProductoDto } from './dto/create-presentacion-producto.dto';
import { UpdatePresentacionProductoDto } from './dto/update-presentacion-producto.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { PresentacionCreateDto } from 'src/products/dto/create-productNew.dto';

@Injectable()
export class PresentacionProductoService {
  private readonly logger = new Logger(PresentacionProductoService.name);

  constructor(private readonly prisma: PrismaService) {}
  async create(
    tx: Prisma.TransactionClient,
    presentaciones: PresentacionCreateDto[],
    productoId: number,
  ) {
    this.logger.log('El array de presentaciones es: ', presentaciones);
    const prod = await tx.producto.findUnique({
      where: { id: productoId },
    });
    if (!prod) throw new NotFoundException('Producto no encontrado');

    const presentacionesWithPrices = await Promise.all(
      presentaciones.map(async (presentacion) => {
        const duplicado = await tx.productoPresentacion.findFirst({
          where: {
            productoId: productoId,
            nombre: presentacion.nombre,
          },
        });

        if (duplicado)
          throw new BadRequestException(
            `Ya existe una presentación con nombre ${presentacion.nombre}`,
          );

        if (presentacion.esDefault) {
          await tx.productoPresentacion.updateMany({
            where: {
              productoId: productoId,
              esDefault: true,
            },
            data: {
              esDefault: false,
            },
          });
        }

        const newPresentacion = await tx.productoPresentacion.create({
          data: {
            nombre: presentacion.nombre,
            codigoBarras: presentacion.codigoBarras,
            esDefault: presentacion.esDefault,
            tipoPresentacion: presentacion.tipoPresentacion,
            costoReferencialPresentacion:
              presentacion.costoReferencialPresentacion,
            producto: {
              connect: {
                id: productoId,
              },
            },
          },
        });

        return await Promise.all(
          presentacion.preciosPresentacion.map(async (precio) => {
            const precioDecimal = new Prisma.Decimal(precio.precio);
            if (precioDecimal.lte(0)) {
              throw new BadRequestException(
                'El precio de un producto no debe ser menor o igual a cero',
              );
            }
            const newPrecioToPresentacion = await tx.precioProducto.create({
              data: {
                estado: 'APROBADO',
                orden: precio.orden,
                precio: precio.precio,
                rol: precio.rol,
                tipo: 'ESTANDAR',
                presentacion: {
                  connect: {
                    id: newPresentacion.id,
                  },
                },
              },
            });
            return newPrecioToPresentacion;
          }),
        );
      }),
    );
    return presentacionesWithPrices;
  }

  async setDefault(id: number) {
    return this.prisma.$transaction(async (tx) => {
      const p = await tx.productoPresentacion.findUnique({ where: { id } });
      if (!p) throw new NotFoundException('Presentación no encontrada');

      await tx.productoPresentacion.updateMany({
        where: { productoId: p.productoId, esDefault: true },
        data: { esDefault: false },
      });

      return tx.productoPresentacion.update({
        where: { id },
        data: { esDefault: true },
      });
    });
  }

  findByProducto(productoId: number) {
    return this.prisma.productoPresentacion.findMany({
      where: { productoId },
      orderBy: [{ esDefault: 'desc' }, { nombre: 'asc' }],
    });
  }

  searchPOS(q: string) {
    // puedes mejorar con unaccent/ILIKE en raw; aquí versión simple
    return this.prisma.productoPresentacion.findMany({
      where: {
        OR: [
          { nombre: { contains: q, mode: 'insensitive' } },
          { codigoBarras: { contains: q, mode: 'insensitive' } },
        ],
        activo: true,
      },
      take: 20,
      orderBy: [{ esDefault: 'desc' }, { nombre: 'asc' }],
      include: {
        producto: { select: { id: true, nombre: true, unidadBase: true } },
      },
    });
  }
}
