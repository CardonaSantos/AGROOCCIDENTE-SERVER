import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreatePresentacionProductoDto } from './dto/create-presentacion-producto.dto';
import { UpdatePresentacionProductoDto } from './dto/update-presentacion-producto.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma, RolPrecio } from '@prisma/client';
import { PresentacionCreateDto } from 'src/products/dto/create-productNew.dto';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';

@Injectable()
export class PresentacionProductoService {
  private readonly logger = new Logger(PresentacionProductoService.name);

  constructor(
    private readonly prisma: PrismaService,

    private readonly cloudinary: CloudinaryService,
  ) {}
  /**
   * Crea presentaciones (con imágenes, stock mínimo y precios) para un producto.
   * La relación entre archivos y presentaciones se hace por el índice del array:
   *  - fieldname esperado: presentaciones[<idx>].images
   */
  async create(
    tx: Prisma.TransactionClient,
    presentaciones: PresentacionCreateDto[],
    productoId: number,
    presImages: Map<number, Express.Multer.File[]> = new Map(),
    creadoPorId?: number, // opcional (si quieres propagar quién creó los precios)
  ) {
    if (!Array.isArray(presentaciones) || presentaciones.length === 0) {
      return [];
    }

    // Asegurar que el producto existe
    const prod = await tx.producto.findUnique({ where: { id: productoId } });
    if (!prod) throw new NotFoundException('Producto no encontrado');

    const results = [];

    // Iteramos por índice para asociar imágenes por "presentaciones[<idx>].images"
    for (let i = 0; i < presentaciones.length; i++) {
      const p = presentaciones[i];

      // Duplicado por nombre (ya existe unique [productoId, nombre], esto evita error 500 y da 400)
      const exists = await tx.productoPresentacion.findFirst({
        where: { productoId, nombre: p.nombre },
        select: { id: true },
      });
      if (exists) {
        throw new BadRequestException(
          `Ya existe una presentación con nombre "${p.nombre}"`,
        );
      }

      // Si esta viene como default, apaga el resto
      if (p.esDefault) {
        await tx.productoPresentacion.updateMany({
          where: { productoId, esDefault: true },
          data: { esDefault: false },
        });
      }

      // Parse del costo referencial (opcional en schema, requerido en DTO con patrón)
      const costoRef =
        p.costoReferencialPresentacion != null &&
        String(p.costoReferencialPresentacion).trim() !== ''
          ? new Prisma.Decimal(p.costoReferencialPresentacion)
          : null;

      // Crear la presentación
      const nuevaPresentacion = await tx.productoPresentacion.create({
        data: {
          productoId,
          nombre: p.nombre,
          descripcion: p.descripcion || null,
          codigoBarras: p.codigoBarras || null,
          esDefault: !!p.esDefault,
          activo: true,
          tipoPresentacion: p.tipoPresentacion,
          costoReferencialPresentacion: costoRef,
        },
      });

      // Stock mínimo de la presentación (1:1)
      if (p.stockMinimo != null && Number.isFinite(p.stockMinimo)) {
        await tx.stockThresholdPresentacion.create({
          data: {
            presentacionId: nuevaPresentacion.id,
            stockMinimo: p.stockMinimo!,
          },
        });
      }

      // Precios de la presentación
      if (
        Array.isArray(p.preciosPresentacion) &&
        p.preciosPresentacion.length
      ) {
        for (const precio of p.preciosPresentacion) {
          const precioDecimal = new Prisma.Decimal(precio.precio);
          if (precioDecimal.lte(0)) {
            throw new BadRequestException(
              `El precio en la presentación "${p.nombre}" debe ser > 0`,
            );
          }

          await tx.precioProducto.create({
            data: {
              presentacionId: nuevaPresentacion.id,
              precio: precio.precio, // Prisma Decimal acepta string
              estado: 'APROBADO',
              tipo: 'ESTANDAR',
              orden: precio.orden,
              rol: precio.rol as RolPrecio,
              creadoPorId: creadoPorId ?? null,
              fechaCreacion: new Date(),
            },
          });
        }
      }

      // Imágenes por presentación (si las mandaron)
      const files = presImages.get(i) ?? [];
      if (files.length) {
        const uploads = await Promise.allSettled(
          files.map((f) => this.cloudinary.subirImagenFile(f)),
        );

        let orden = 0;
        for (let idx = 0; idx < uploads.length; idx++) {
          const r = uploads[idx];
          const file = files[idx];

          if (r.status === 'fulfilled') {
            const { url, public_id } = r.value;
            await tx.imagenPresentacion.create({
              data: {
                presentacionId: nuevaPresentacion.id,
                url,
                public_id,
                altTexto: file?.originalname ?? null,
                orden: orden++,
              },
            });
          } else {
            this.logger.error(
              `Error subiendo imagen de presentación [${i}] idx=${idx}:`,
              r.reason,
            );
            // seguimos con las demás sin romper toda la creación
          }
        }
      }

      // Recuperar la presentación con relaciones útiles para devolver
      const createdWithRels = await tx.productoPresentacion.findUnique({
        where: { id: nuevaPresentacion.id },
        include: {
          stockThresholdPresentacion: true,
          imagenesPresentacion: true,
          precios: true,
        },
      });

      results.push(createdWithRels);
    }

    return results;
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
