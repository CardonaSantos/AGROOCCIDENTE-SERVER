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
  private dec = (v: any): string => (v == null ? '0' : String(v));

  /**
   * Crea presentaciones (con imágenes, stock mínimo y precios) para un producto.
   * La relación entre archivos y presentaciones se hace por el índice del array:
   *  - fieldname esperado: presentaciones[<idx>].images
   */
  // presentacion-producto.service.ts
  async create(
    tx: Prisma.TransactionClient,
    presentaciones: PresentacionCreateDto[],
    productoId: number,
    presImages: Map<number, Express.Multer.File[]> = new Map(),
    creadoPorId?: number,
  ) {
    if (!Array.isArray(presentaciones) || presentaciones.length === 0)
      return [];

    const prod = await tx.producto.findUnique({ where: { id: productoId } });
    if (!prod) throw new NotFoundException('Producto no encontrado');

    const results = [];

    for (let i = 0; i < presentaciones.length; i++) {
      const p = presentaciones[i];

      // (opcional) evitar duplicado por nombre
      const exists = await tx.productoPresentacion.findFirst({
        where: { productoId, nombre: p.nombre },
        select: { id: true },
      });
      if (exists) {
        throw new BadRequestException(
          `Ya existe una presentación "${p.nombre}"`,
        );
      }

      // (opcional) validar duplicado de código de barras si viene
      if (p.codigoBarras) {
        const dupBar = await tx.productoPresentacion.findFirst({
          where: { codigoBarras: p.codigoBarras },
          select: { id: true },
        });
        if (dupBar) {
          throw new BadRequestException(
            `Ya existe una presentación con código de barras "${p.codigoBarras}"`,
          );
        }
      }

      if (p.esDefault) {
        await tx.productoPresentacion.updateMany({
          where: { productoId, esDefault: true },
          data: { esDefault: false },
        });
      }

      const costoRef =
        p.costoReferencialPresentacion != null &&
        String(p.costoReferencialPresentacion).trim() !== ''
          ? new Prisma.Decimal(p.costoReferencialPresentacion)
          : null;

      // ✅ Crear presentación + relaciones nuevas
      const nuevaPresentacion = await tx.productoPresentacion.create({
        data: {
          nombre: p.nombre,
          descripcion: p.descripcion || null,
          codigoBarras: p.codigoBarras || null,
          esDefault: !!p.esDefault,
          activo: true,
          costoReferencialPresentacion: costoRef,

          // ✅ TipoPresentacion (nullable)
          ...(p.tipoPresentacionId
            ? { tipoPresentacion: { connect: { id: p.tipoPresentacionId } } }
            : {}),

          // ✅ Categorías (M:N)
          ...(p.categoriaIds?.length
            ? { categorias: { connect: p.categoriaIds.map((id) => ({ id })) } }
            : {}),
          producto: {
            connect: {
              id: productoId,
            },
          },
        },
      });

      // Stock mínimo 1:1
      if (p.stockMinimo != null && Number.isFinite(p.stockMinimo)) {
        await tx.stockThresholdPresentacion.create({
          data: {
            presentacionId: nuevaPresentacion.id,
            stockMinimo: p.stockMinimo!,
          },
        });
      }

      // Precios por presentación
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
              precio: precio.precio,
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

      // Imágenes por presentación
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
          }
        }
      }

      const createdWithRels = await tx.productoPresentacion.findUnique({
        where: { id: nuevaPresentacion.id },
        include: {
          stockThresholdPresentacion: true,
          imagenesPresentacion: true,
          precios: true,
          // (opcional) agrega relaciones si deseas devolverlas
          tipoPresentacion: true,
          categorias: true,
        },
      });

      results.push(createdWithRels!);
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

  //NUEVOS

  async getPresentationDetail(id: number) {
    const sp = await this.prisma.productoPresentacion.findUnique({
      where: { id },
      include: {
        producto: { select: { id: true } },
        categorias: true,
        tipoPresentacion: true,
        imagenesPresentacion: true,
        precios: { orderBy: { orden: 'asc' } },
        stockThresholdPresentacion: {
          select: {
            stockMinimo: true,
          },
        },
      },
    });
    if (!sp) throw new NotFoundException('Presentación no encontrada');

    const data = {
      id: sp.id,
      productoId: sp.producto?.id ?? 0,
      nombre: sp.nombre,
      codigoBarras: sp.codigoBarras,
      tipoPresentacionId: sp.tipoPresentacionId,
      tipoPresentacion: sp.tipoPresentacion && {
        id: sp.tipoPresentacion.id,
        nombre: sp.tipoPresentacion.nombre,
      },
      costoReferencialPresentacion: this.dec(sp.costoReferencialPresentacion),
      descripcion: sp.descripcion,

      // 🔧 null-safe
      stockMinimo: sp.stockThresholdPresentacion?.stockMinimo ?? 0,

      precios: sp.precios.map((px) => ({
        rol: px.rol,
        orden: px.orden,
        precio: this.dec(px.precio),
      })),
      esDefault: !!sp.esDefault,
      imagenesPresentacion: sp.imagenesPresentacion.map((i) => ({
        id: i.id,
        url: i.url,
        public_id: i.public_id,
        name: i.altTexto ?? null,
      })),
      activo: !!sp.activo,
      categorias: sp.categorias.map(({ id, nombre }) => ({ id, nombre })),
    };

    this.logger.log(
      `La data a retornar al formulario de edicion de producto es:\n${JSON.stringify(data, null, 2)}`,
    );
  }
}
