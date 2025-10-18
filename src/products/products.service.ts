import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  MethodNotAllowedException,
} from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateNewProductDto } from './dto/create-productNew.dto';
import { MinimunStockAlertService } from 'src/minimun-stock-alert/minimun-stock-alert.service';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { Prisma, RolPrecio } from '@prisma/client';

import { PresentacionProductoService } from 'src/presentacion-producto/presentacion-producto.service';
import { ProductoApi } from './dto/interfacesPromise';
import { QueryParamsInventariado } from './query/query';
import {
  presentacionSelect,
  PresentacionWithSelect,
  productoSelect,
  ProductoWithSelect,
} from './SelectsAndWheres/Selects';
import {
  PrecioProductoNormalized,
  ProductoInventarioResponse,
  StockPorSucursal,
  StocksBySucursal,
  StocksProducto,
} from './ResponseInterface';
import * as dayjs from 'dayjs';
import 'dayjs/locale/es';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';
import * as isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import * as isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import { newQueryDTO } from './query/newQuery';
import { verifyProps } from 'src/utils/verifyPropsFromDTO';
import { buildSearchForProducto } from './HELPERS';
import { itemsBase } from './seed/utils';
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.locale('es');

const toDecimal = (value: string | number) => {
  return new Prisma.Decimal(value);
};
//HELPÉ
@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);
  constructor(
    private readonly prisma: PrismaService,

    private readonly minimunStockAlert: MinimunStockAlertService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly presentacionPrducto: PresentacionProductoService,
  ) {}

  //AJUSTAR CREACION DE IMAGENES
  // products.service.ts (solo el método create)
  async create(
    dto: CreateNewProductDto,
    imagenes: Express.Multer.File[],
    presImages: Map<number, Express.Multer.File[]> = new Map(),
  ) {
    try {
      const {
        codigoProducto,
        creadoPorId,
        nombre,
        precioVenta,
        categorias,
        codigoProveedor,
        descripcion,
        precioCostoActual,
        presentaciones,
        stockMinimo,
      } = dto;

      this.logger.log(
        `DTO recibido en crear producto:\n${JSON.stringify(dto, null, 2)}`,
      );

      return await this.prisma.$transaction(async (tx) => {
        // OJO: en schema es Float?, así que parsea a number
        const costoActualNumber =
          precioCostoActual != null && String(precioCostoActual).trim() !== ''
            ? Number(precioCostoActual)
            : null;

        const newProduct = await tx.producto.create({
          data: {
            precioCostoActual: costoActualNumber,
            codigoProducto,
            codigoProveedor: codigoProveedor || null,
            nombre,
            descripcion: descripcion || null,
            categorias: {
              connect: categorias?.map((id) => ({ id })) ?? [],
            },
          },
        });

        // Precios a nivel producto
        const preciosCreados = await Promise.all(
          (precioVenta ?? []).map((precio) =>
            tx.precioProducto.create({
              data: {
                productoId: newProduct.id,
                precio: precio.precio, // string OK (Decimal)
                estado: 'APROBADO',
                tipo: 'ESTANDAR',
                creadoPorId: creadoPorId,
                fechaCreacion: new Date(),
                orden: precio.orden,
                rol: precio.rol,
              },
            }),
          ),
        );

        // Stock mínimo de producto (1:1)
        if (stockMinimo != null) {
          await tx.stockThreshold.create({
            data: {
              productoId: newProduct.id,
              stockMinimo,
            },
          });
        }

        // Imágenes del PRODUCTO
        if (imagenes?.length) {
          const uploads = await Promise.allSettled(
            imagenes.map((file) =>
              this.cloudinaryService.subirImagenFile(file),
            ),
          );

          for (let idx = 0; idx < uploads.length; idx++) {
            const r = uploads[idx];
            const file = imagenes[idx];

            if (r.status === 'fulfilled') {
              const { url, public_id } = r.value;
              await this.vincularProductoImagen(
                tx,
                newProduct.id,
                url,
                public_id,
                file?.originalname,
              );
            } else {
              this.logger.error(`Error subiendo imagen [${idx}]`, r.reason);
            }
          }
        } else {
          this.logger.debug('No hay imágenes de producto para subir/crear');
        }

        const createdPresentations = await this.presentacionPrducto.create(
          tx,
          presentaciones ?? [],
          newProduct.id,
          presImages,
          creadoPorId,
        );

        return {
          newProduct,
          preciosCreados,
          presentaciones: createdPresentations,
        };
      });
    } catch (error) {
      this.logger.error('Error al crear producto:', error);
      throw new InternalServerErrorException(
        'No se pudo crear el producto y sus datos asociados',
      );
    }
  }

  async vincularProductoImagen(
    tx: Prisma.TransactionClient,
    productoId: number,
    url: string,
    publicId: string,
    altTexto?: string,
  ) {
    return tx.imagenProducto.create({
      data: {
        productoId,
        url,
        public_id: publicId,
        altTexto: altTexto ?? null,
      },
    });
  }

  async findAllProductsToSale(id: number) {
    try {
      const productos = await this.prisma.producto.findMany({
        include: {
          precios: {
            select: {
              id: true,
              precio: true,
              rol: true,
            },
          },
          imagenesProducto: {
            select: {
              id: true,
              url: true,
            },
          },
          stock: {
            where: {
              cantidad: { gt: 0 },
              sucursalId: id,
            },
            select: {
              id: true,
              cantidad: true,
              fechaIngreso: true,
              fechaVencimiento: true,
            },
          },
          presentaciones: {
            include: {
              stockPresentaciones: {
                where: {
                  cantidadPresentacion: { gt: 0 },
                  sucursalId: id,
                },
                select: {
                  id: true,
                  cantidadPresentacion: true,
                  fechaIngreso: true,
                  fechaVencimiento: true,
                },
              },
              precios: {
                select: {
                  id: true,
                  precio: true,
                  rol: true,
                },
              },
            },
          },
        },
      });

      const formattedProducts = productos.map((prod) => ({
        id: prod.id,
        nombre: prod.nombre,
        descripcion: prod.descripcion,
        codigoProducto: prod.codigoProducto,
        creadoEn: prod.creadoEn,
        actualizadoEn: prod.actualizadoEn,
        stock: prod.stock.map((t) => ({
          id: t.id,
          cantidad: t.cantidad,
          fechaIngreso: t.fechaIngreso,
          fechaVencimiento: t.fechaVencimiento,
        })),
        precios: prod.precios.map((p) => ({
          id: p.id,
          precio: p.precio,
          rol: p.rol,
        })),
        imagenesProducto: prod.imagenesProducto.map((img) => ({
          id: img.id,
          url: img.url,
        })),
        presentaciones: prod.presentaciones.map((pres) => ({
          id: pres.id,
          nombre: pres.nombre,
          // sku: pres.sku,
          codigoBarras: pres.codigoBarras,
          tipoPresentacion: pres.tipoPresentacion,
          precios: pres.precios.map((pp) => ({
            id: pp.id,
            precio: pp.precio,
            rol: pp.rol,
          })),
          stockPresentaciones: pres.stockPresentaciones.map((s) => ({
            id: s.id,
            cantidadPresentacion: s.cantidadPresentacion,
            fechaIngreso: s.fechaIngreso,
            fechaVencimiento: s.fechaVencimiento,
          })),
        })),
      }));

      return formattedProducts;
    } catch (error) {
      this.logger.error('Error en findAll productos:', error);
      throw new InternalServerErrorException('Error al obtener los productos');
    }
  }

  /**
   * Funcion que retorna y filtra productos para el POS, apoyandose de servicios que usa el inventariado
   * @param dto
   * @returns PRODUCTOS Y PRESENTACIONES FILTRADAS PARA UN TABLE PAGINADO
   */
  async getProductPresentationsForPOS(dto: newQueryDTO) {
    try {
      this.logger.log(
        `DTO recibido en search de productos POS:\n${JSON.stringify(dto, null, 2)}`,
      );

      verifyProps<newQueryDTO>(dto, ['sucursalId', 'limit', 'page']);
      const page = Math.max(1, Number(dto.page) || 1);
      const limit = Math.min(Math.max(1, Number(dto.limit) || 20), 100);

      const whereProducto: Prisma.ProductoWhereInput = {};
      const wherePresentacion: Prisma.ProductoPresentacionWhereInput = {};

      this.asignePropsWhereInput(dto, whereProducto);
      this.asignePropsWhereInputPresentation(dto, wherePresentacion);

      // Para paginar el "mix" haremos:
      const [totalProducts, totalPresentations] = await Promise.all([
        this.prisma.producto.count({ where: whereProducto }),
        this.prisma.productoPresentacion.count({ where: wherePresentacion }),
      ]);

      const totalCount = totalProducts + totalPresentations;
      const totalPages = Math.max(1, Math.ceil(totalCount / limit));
      const skipCombined = (page - 1) * limit;

      let skipProd = 0;
      let skipPres = 0;
      if (skipCombined < totalProducts) {
        skipProd = skipCombined;
      } else {
        skipProd = totalProducts;
        skipPres = skipCombined - totalProducts;
      }

      const takeProd = Math.max(0, Math.min(limit, totalProducts - skipProd));
      const remaining = limit - takeProd;
      const takePres = Math.max(
        0,
        Math.min(remaining, totalPresentations - skipPres),
      );

      const [products, presentations] = await Promise.all([
        this.prisma.producto.findMany({
          where: whereProducto,
          skip: skipProd,
          take: takeProd,
          select: productoSelect,
          orderBy: { id: 'asc' },
        }),
        this.prisma.productoPresentacion.findMany({
          where: wherePresentacion,
          skip: skipPres,
          take: takePres,
          select: presentacionSelect,
          orderBy: { id: 'asc' },
        }),
      ]);

      const productsArray = Array.isArray(products)
        ? this.normalizerProductsInventario(products)
        : [];

      const presentationsArray = Array.isArray(presentations)
        ? this.normalizerProductPresentacionInventario(presentations)
        : [];

      const mixed = [
        ...productsArray.map((x) => ({ ...x, __source: 'producto' })),
        ...presentationsArray.map((x) => ({ ...x, __source: 'presentacion' })),
      ];

      return {
        data: mixed,
        meta: {
          totalCount,
          totalPages,
          page,
          limit,
          totals: {
            productos: totalProducts,
            presentaciones: totalPresentations,
          },
        },
      };
    } catch (error) {
      this.logger.error('Error generado en get productos POS: ', error?.stack);
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'Fatal Error: Error inesperado en modulo de productos',
      );
    }
  }

  asignePropsWhereInput(dto: newQueryDTO, where: Prisma.ProductoWhereInput) {
    const {
      cats,
      codigoItem,
      codigoProveedor,
      priceRange,
      nombreItem,
      sucursalId,
      tipoEmpaque, // pendiente de migración
    } = dto;

    if (!dto) throw new BadRequestException('Datos inválidos');

    // 1) filtros existentes
    if (Array.isArray(cats) && cats.length > 0) {
      where.categorias = { some: { id: { in: cats } } };
    }

    if (codigoItem) {
      // si el front todavía manda codigoItem, mantenlo
      where.codigoProducto = { contains: codigoItem, mode: 'insensitive' };
    }

    if (codigoProveedor) {
      where.codigoProveedor = {
        contains: codigoProveedor,
        mode: 'insensitive',
      };
    }

    if (nombreItem) {
      where.nombre = { contains: nombreItem, mode: 'insensitive' };
    }

    if (priceRange != null) {
      if (Array.isArray(priceRange) && priceRange.length === 2) {
        const [min, max] = priceRange;
        where.precios = {
          some: {
            precio: { gte: min ?? 0, lte: max ?? Number.MAX_SAFE_INTEGER },
          },
        };
      } else if (typeof priceRange === 'number') {
        where.precios = { some: { precio: { equals: priceRange } } };
      }
    }

    const toAndArray = (
      x?: Prisma.ProductoWhereInput | Prisma.ProductoWhereInput[],
    ): Prisma.ProductoWhereInput[] => (Array.isArray(x) ? x : x ? [x] : []);

    const toPresentacionAndArray = (
      x?:
        | Prisma.ProductoPresentacionWhereInput
        | Prisma.ProductoPresentacionWhereInput[],
    ): Prisma.ProductoPresentacionWhereInput[] =>
      Array.isArray(x) ? x : x ? [x] : [];

    // 2) BUSQUEDA UNIFICADA (q) — fallback al único input
    const q = (dto as any).q ?? dto.nombreItem ?? dto.codigoItem ?? '';
    const textSearch = buildSearchForProducto(q);
    if (textSearch) {
      where.AND = [...toAndArray(where.AND), textSearch];
    }

    return where;
  }

  asignePropsWhereInputPresentation(
    dto: newQueryDTO,
    where: Prisma.ProductoPresentacionWhereInput,
  ) {
    const {
      cats,
      codigoItem,
      codigoProveedor,
      priceRange,
      nombreItem,
      sucursalId,
      tipoEmpaque,
    } = dto;

    if (!dto) throw new BadRequestException('Datos inválidos');

    if (codigoItem) {
      where.codigoBarras = { contains: codigoItem, mode: 'insensitive' };
    }

    if (nombreItem) {
      where.nombre = { contains: nombreItem, mode: 'insensitive' };
    }

    if (Array.isArray(cats) && cats.length > 0) {
      where.producto = { is: { categorias: { some: { id: { in: cats } } } } };
    }

    if (codigoProveedor) {
      where.producto = {
        is: {
          ...(where.producto?.is ?? {}),
          codigoProveedor: { contains: codigoProveedor, mode: 'insensitive' },
        },
      };
    }

    if (priceRange != null) {
      if (Array.isArray(priceRange) && priceRange.length === 2) {
        const [min, max] = priceRange;
        where.precios = {
          some: {
            precio: { gte: min ?? 0, lte: max ?? Number.MAX_SAFE_INTEGER },
          },
        };
      } else if (typeof priceRange === 'number') {
        where.precios = { some: { precio: { equals: priceRange } } };
      }
    }
    // tipoEmpaque: cuando migres, filtra aquí
    return where;
  }

  async findAll() {
    try {
      const productos = await this.prisma.producto.findMany({
        include: {
          stockThreshold: {
            select: {
              id: true,
              stockMinimo: true,
            },
          },
          precios: {
            select: {
              id: true,
              precio: true,
              tipo: true,
              usado: true,
              orden: true,
              rol: true,
            },
          },
          categorias: {
            select: {
              id: true,
              nombre: true,
            },
          },
          stock: {
            include: {
              sucursal: {
                select: {
                  id: true,
                  nombre: true,
                },
              },
              entregaStock: {
                include: {
                  proveedor: {
                    select: {
                      nombre: true, // Solo seleccionamos el nombre del proveedor
                    },
                  },
                },
              },
            },
            where: {
              cantidad: {
                gt: 0, // Solo traer productos con stock disponible
              },
            },
          },
        },
      });
      return productos;
    } catch (error) {
      console.error('Error en findAll productos:', error); // Proporcionar más contexto en el error
      throw new InternalServerErrorException('Error al obtener los productos');
    }
  }

  async findAllProductsToTransfer(id: number) {
    try {
      const productos = await this.prisma.producto.findMany({
        include: {
          stock: {
            where: {
              cantidad: {
                gt: 0, // Solo traer productos con stock disponible
              },
              sucursalId: id,
            },
          },
        },
      });
      return productos;
    } catch (error) {
      console.error('Error en findAll productos:', error); // Proporcionar más contexto en el error
      throw new InternalServerErrorException('Error al obtener los productos');
    }
  }

  async findAllProductsToStcok() {
    try {
      const productos = await this.prisma.producto.findMany({
        select: {
          id: true,
          nombre: true,
          codigoProducto: true,
        },
        orderBy: {
          actualizadoEn: 'desc',
        },
      });

      return productos;
    } catch (error) {
      console.error('Error en findAll productos:', error); // Proporcionar más contexto en el error
      throw new InternalServerErrorException('Error al obtener los productos');
    }
  }

  async productToEdit(id: number) {
    try {
      console.log('buscando un producto');

      const product = await this.prisma.producto.findUnique({
        where: {
          id,
        },
        include: {
          stockThreshold: true,
          categorias: true,
          imagenesProducto: {
            select: {
              id: true,
              url: true,
              public_id: true,
            },
          },
          precios: {
            select: {
              id: true,
              precio: true,
              orden: true,
              rol: true,
              tipo: true,
            },
          },
        },
      });

      return product;
    } catch (error) {
      console.error('Error en findAll productos:', error); // Proporcionar más contexto en el error
      throw new InternalServerErrorException('Error al obtener los productos');
    }
  }

  async productHistorialPrecios() {
    try {
      const historialPrecios = await this.prisma.historialPrecioCosto.findMany({
        include: {
          modificadoPor: {
            select: {
              nombre: true,
              id: true,
              rol: true,
              sucursal: {
                // Debes hacer include aquí
                select: {
                  nombre: true,
                  id: true,
                  direccion: true,
                },
              },
            },
          },
          producto: true, // Suponiendo que deseas incluir todo el producto
        },
        orderBy: {
          fechaCambio: 'desc',
        },
      });
      return historialPrecios;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Error');
    }
  }

  async productToWarranty() {
    try {
      const products = await this.prisma.producto.findMany({
        orderBy: {
          creadoEn: 'desc',
        },
      });
      return products;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Error al encontrar productos');
    }
  }

  async findOne(id: number) {
    try {
      const producto = await this.prisma.producto.findUnique({
        where: { id },
      });
      return producto;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Error al encontrar el producto');
    }
  }

  async update(id: number, updateProductDto: UpdateProductDto) {
    console.log(
      'Actualizando producto con ID:',
      id,
      'con datos:',
      updateProductDto,
    );

    const productoAnterior = await this.prisma.producto.findUnique({
      where: { id },
      include: { stockThreshold: true },
    });

    try {
      // 2) Abrimos la transacción
      const productoActualizado = await this.prisma.$transaction(async (tx) => {
        // 2.1) Actualizar datos básicos y categorías
        const productoUpdate = await tx.producto.update({
          where: { id },
          data: {
            codigoProducto: updateProductDto.codigoProducto,
            codigoProveedor: updateProductDto.codigoProveedor,
            nombre: updateProductDto.nombre,
            descripcion: updateProductDto.descripcion,
            precioCostoActual: Number(updateProductDto.precioCostoActual),
            categorias: {
              set: [],
              connect:
                updateProductDto.categorias?.map((cid) => ({ id: cid })) || [],
            },
          },
          include: {
            categorias: true,
            stockThreshold: true,
          },
        });

        // 2.2) Upsert de stockThreshold
        if (updateProductDto.stockMinimo !== undefined) {
          await tx.stockThreshold.upsert({
            where: { productoId: id },
            update: { stockMinimo: updateProductDto.stockMinimo },
            create: {
              producto: { connect: { id } },
              stockMinimo: updateProductDto.stockMinimo,
            },
          });
        }

        // 2.3) Update / create de precios
        for (const price of updateProductDto.precios || []) {
          if (price.id) {
            await tx.precioProducto.update({
              where: { id: price.id },
              data: {
                precio: price.precio,
                rol: price.rol,
                orden: price.orden,
              },
            });
          } else {
            await tx.precioProducto.create({
              data: {
                estado: 'APROBADO',
                precio: price.precio,
                creadoPorId: updateProductDto.usuarioId,
                productoId: productoUpdate.id,
                tipo: 'ESTANDAR',
                orden: price.orden,
                rol: price.rol,
              },
            });
          }
        }

        // 2.4) Historial de cambio de precio de costo
        if (
          productoAnterior &&
          Number(productoAnterior.precioCostoActual) !==
            Number(productoUpdate.precioCostoActual)
        ) {
          const newRegistroCambioPrecio = await tx.historialPrecioCosto.create({
            data: {
              motivoCambio: updateProductDto.motivoCambio,
              sucursal: {
                connect: {
                  id: updateProductDto.sucursalId,
                },
              },
              producto: {
                connect: {
                  id: productoAnterior.id,
                },
              },
              precioCostoAnterior: Number(productoAnterior.precioCostoActual),
              precioCostoNuevo: Number(productoUpdate.precioCostoActual),
              modificadoPor: {
                connect: {
                  id: updateProductDto.modificadoPorId,
                },
              },
            },
          });

          this.logger.log(
            'El registro de cambio de precio es: ',
            newRegistroCambioPrecio,
          );
        }

        // 2.5) Subida y vinculación de imágenes
        // if (updateProductDto.imagenes?.length) {
        //   const promesas = updateProductDto.imagenes.map((base64) =>
        //     this.cloudinaryService.subirImagenFile(base64),
        //   );
        //   const resultados = await Promise.allSettled(promesas);

        //   for (let idx = 0; idx < resultados.length; idx++) {
        //     const res = resultados[idx];
        //     if (res.status === 'fulfilled') {
        //       const { url, public_id } = res.value;
        //       // Usamos tx para la vinculación
        //       await this.vincularProductoImagen(
        //         tx,
        //         productoUpdate.id,
        //         url,
        //         public_id,
        //       );
        //     } else {
        //       console.error(`Error subiendo imagen [${idx}]:`, res.reason);
        //     }
        //   }
        // }

        return productoUpdate;
      });

      return productoActualizado;
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Error al actualizar el producto');
    }
  }

  async remove(id: number) {
    try {
      const producto = await this.prisma.producto.delete({
        where: { id },
      });
      return producto;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Error al eliminar el producto');
    }
  }

  async removeAll() {
    try {
      const productos = await this.prisma.producto.deleteMany({});
      return productos;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Error al eliminar los productos');
    }
  }

  async removePrice(id: number) {
    if (!id) {
      throw new BadRequestException({
        error: 'ID de precio no proporcionado',
      });
    }

    try {
      const priceToDelete = await this.prisma.precioProducto.delete({
        where: { id },
      });

      if (!priceToDelete) {
        throw new InternalServerErrorException({
          message: 'Error al eliminar el precio',
        });
      }

      // ¡Listo, elimina y retorna éxito!
      return {
        message: 'Precio eliminado correctamente',
        price: priceToDelete,
        success: true,
      };
    } catch (error) {
      // Siempre lanza, no retornes el error
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException({
        message: 'Error inesperado',
        details: error?.message,
      });
    }
  }

  async removeImageFromProduct(publicId: string, imageId: number) {
    console.log('el publicId es: ', publicId, ' y el imageId es: ', imageId);

    if (!imageId) {
      throw new MethodNotAllowedException(
        'No se ha proporcionado un ID de imagen',
      );
    }

    if (!publicId) {
      throw new MethodNotAllowedException(
        'No se ha proporcionado un ID de imagen',
      );
    }

    try {
      await this.prisma.imagenProducto.delete({
        where: {
          id: imageId,
        },
      });
      await this.cloudinaryService.BorrarImagen(publicId);
    } catch (error) {
      console.log(error);
    }
  }

  async productToCredit() {
    try {
      const products = await this.prisma.producto.findMany({
        select: {
          id: true,
          nombre: true,
          codigoProducto: true,
        },
      });
      return products;
    } catch (error) {
      console.log(error);
      throw new BadRequestException(
        'Error al conseguir datos de los productos',
      );
    }
  }

  async getBySearchProducts(
    q: string,
    sucursalId: string,
  ): Promise<ProductoApi[]> {
    try {
      let where: Prisma.ProductoWhereInput = {};

      if (q) {
        where.OR = [
          { nombre: { contains: q.trim().toLowerCase(), mode: 'insensitive' } },
          {
            descripcion: {
              contains: q.trim().toLowerCase(),
              mode: 'insensitive',
            },
          },
          {
            codigoProducto: {
              contains: q.trim().toLowerCase(),
              mode: 'insensitive',
            },
          },
          {
            codigoProveedor: {
              contains: q.trim().toLowerCase(),
              mode: 'insensitive',
            },
          },
        ];
      }

      if (sucursalId) {
        where = {
          ...where,
        };
      }

      const productsFind = await this.prisma.producto.findMany({
        where,
        select: {
          id: true,
          nombre: true,
          descripcion: true,
          codigoProducto: true,
          precios: {
            orderBy: { orden: 'desc' },
            select: { id: true, precio: true, rol: true },
          },
          stock: {
            where: { sucursalId: parseInt(sucursalId), cantidad: { gt: 0 } },
            select: { id: true, cantidad: true },
          },
          imagenesProducto: { select: { id: true, url: true } },
          presentaciones: {
            select: {
              id: true,
              nombre: true,
              codigoBarras: true,
              tipoPresentacion: true,
              // sku: true,
              stockPresentaciones: {
                where: {
                  sucursalId: parseInt(sucursalId),
                  cantidadPresentacion: { gt: 0 },
                },
                select: { id: true, cantidadPresentacion: true },
              },
              precios: {
                orderBy: { orden: 'desc' },
                select: { id: true, precio: true, rol: true },
              },
            },
          },
        },
      });

      // === Map Prisma → ProductoApi ===
      const productos: ProductoApi[] = productsFind.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        descripcion: p.descripcion,
        codigoProducto: p.codigoProducto,
        precios: p.precios.map((pr) => ({
          id: pr.id,
          precio: pr.precio.toString(),
          rol: pr.rol,
        })),
        stock: p.stock.map((s) => ({
          id: s.id,
          cantidad: s.cantidad,
        })),
        imagenesProducto: p.imagenesProducto?.map((img) => ({
          id: img.id,
          url: img.url,
        })),
        presentaciones: p.presentaciones.map((pres) => ({
          id: pres.id,
          nombre: pres.nombre,
          // sku: pres.sku,
          codigoBarras: pres.codigoBarras,
          tipoPresentacion: pres.tipoPresentacion,
          precios: pres.precios.map((pr) => ({
            id: pr.id,
            precio: pr.precio.toString(),
            rol: pr.rol,
          })),
          stockPresentaciones: pres.stockPresentaciones.map((sp) => ({
            id: sp.id,
            cantidad: sp.cantidadPresentacion,
          })),
        })),
      }));

      return productos;
    } catch (error) {
      this.logger.error('Error generado en search productos: ', error);
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'Error inesperado al buscar productos',
      );
    }
  }

  async getProductosPresentacionesForInventary(dto: QueryParamsInventariado) {
    try {
      const {
        precio,
        sucursalId,
        tipoPresentacion,
        categorias,
        codigoProducto,
        fechaVencimiento,
        productoNombre,
        limit,
        page,
      } = dto;
      this.logger.log('nuevo para inventariado');

      const skip = (page - 1) * limit;

      const where: Prisma.ProductoWhereInput = {};
      const wherePresentaciones: Prisma.ProductoPresentacionWhereInput = {};
      // WHERE DINAMICO DE PRODUCTO
      if (productoNombre) {
        where.nombre = { contains: productoNombre, mode: 'insensitive' };
      }

      if (codigoProducto) {
        where.codigoProducto = { equals: codigoProducto, mode: 'insensitive' };
      }

      if (categorias && categorias.length > 0) {
        where.categorias = {
          some: {
            id: { in: categorias },
          },
        };
      }

      if (fechaVencimiento) {
        where.stock = {
          some: {
            fechaVencimiento: fechaVencimiento,
          },
        };
      }

      if (precio) {
        where.precios = {
          some: {
            precio: { equals: precio },
          },
        };
      }

      // WHERE DINAMICO DE PRESENTACIONES PRODUCTOS
      if (productoNombre) {
        wherePresentaciones.nombre = {
          contains: productoNombre,
          mode: 'insensitive',
        };
      }

      if (codigoProducto) {
        wherePresentaciones.codigoBarras = {
          contains: codigoProducto,
          mode: 'insensitive',
        };
      }

      if (tipoPresentacion) {
        wherePresentaciones.tipoPresentacion = {
          in: tipoPresentacion,
        };
      }

      if (precio) {
        wherePresentaciones.precios = {
          some: {
            precio: { equals: precio },
          },
        };
      }

      if (fechaVencimiento) {
        wherePresentaciones.stockPresentaciones = {
          some: {
            fechaVencimiento: {
              equals: fechaVencimiento,
            },
          },
        };
      }

      const productoSelectFor = (
        sucursalId?: number,
      ): Prisma.ProductoSelect => ({
        ...productoSelect,
        stock: {
          // filtra los renglones de stock que se devuelven, pero
          // NO condiciona que el producto exista
          where: sucursalId ? { sucursalId } : undefined,
          select: {
            id: true,
            cantidad: true,
            fechaVencimiento: true,
            fechaIngreso: true,
            sucursal: { select: { id: true, nombre: true } },
          },
        },
      });

      const presentacionSelectFor = (
        sucursalId?: number,
      ): Prisma.ProductoPresentacionSelect => ({
        ...presentacionSelect,
        stockPresentaciones: {
          where: sucursalId ? { sucursalId } : undefined,
          select: {
            id: true,
            cantidadPresentacion: true,
            fechaVencimiento: true,
            fechaIngreso: true,
            sucursal: { select: { id: true, nombre: true } },
          },
        },
      });

      this.logger.log(`DTO recibido:\n${JSON.stringify(dto, null, 2)}`);

      const [productos, presentaciones, totalProductos, totalPresentaciones]: [
        ProductoWithSelect[],
        PresentacionWithSelect[],
        number,
        number,
      ] = await Promise.all([
        this.prisma.producto.findMany({
          where: where,
          select: productoSelect,
          skip: skip,
          take: limit,
        }),
        this.prisma.productoPresentacion.findMany({
          where: wherePresentaciones,
          select: presentacionSelect,
          skip: skip,
          take: limit,
        }),
        //TOTALES PARA META DEL TABLE
        this.prisma.producto.count({ where }),
        this.prisma.productoPresentacion.count({ where: wherePresentaciones }),
      ]);

      const productosArray = Array.isArray(productos)
        ? this.normalizerProductsInventario(productos)
        : [];

      const presentacionesArray = Array.isArray(presentaciones)
        ? this.normalizerProductPresentacionInventario(presentaciones)
        : [];

      // DATOS META PARA LA TABLE====>
      const mixed = [...productosArray, ...presentacionesArray];
      const totalCount = totalProductos + totalPresentaciones;
      const totalPages = Math.ceil(totalCount / limit);
      return {
        data: mixed,
        meta: {
          totalCount,
          totalPages,
          page,
          limit,
        },
      };
    } catch (error) {
      this.logger.error(
        'El error generado en get de productos y presentaciones es: ',
        error?.stack,
      );
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'Fatal error: Error inesperado en servicio de inventariado',
      );
    }
  }

  // HELPERS =======================>

  normalizerProductsInventario(
    arrayProductos: ProductoWithSelect[],
  ): ProductoInventarioResponse[] {
    return arrayProductos.map((p) => {
      // precios
      const precios: PrecioProductoNormalized[] = (p.precios ?? []).map(
        (pr) => ({
          id: pr.id,
          orden: pr.orden,
          precio: pr.precio.toString(),
          rol: pr.rol,
          tipo: pr.tipo,
        }),
      );

      // stocks crudos
      const stocks: StocksProducto[] = (p.stock ?? []).map((s) => ({
        id: s.id,
        cantidad: Number(s.cantidad ?? 0),
        fechaIngreso: s.fechaIngreso
          ? dayjs(s.fechaIngreso).format('DD-MM-YYYY')
          : '',
        fechaVencimiento: s.fechaVencimiento
          ? dayjs(s.fechaVencimiento).format('DD-MM-YYYY')
          : '',
      }));

      //retorno un objeto con RECORD personalizado
      const dict = (p.stock ?? []).reduce<Record<string, StockPorSucursal>>(
        (acc, s) => {
          const sucursalId = s.sucursal.id ?? 0;
          const key = String(sucursalId);
          const nombre = s.sucursal?.nombre ?? key;
          //existe? sino nuevo
          const item = acc[key] ?? {
            sucursalId: sucursalId,
            nombre: nombre,
            cantidad: 0,
          };
          item.cantidad += Number(s.cantidad ?? 0);
          acc[key] = item;
          return acc;
        },
        {},
      );
      const stocksBySucursal: StocksBySucursal = Object.values(dict);

      return {
        id: p.id,
        nombre: p.nombre,
        codigoProducto: p.codigoProducto ?? '',
        descripcion: p.descripcion ?? '',
        precioCosto:
          p.precioCostoActual != null ? p.precioCostoActual.toString() : '0', // <- string
        precios,
        stocks,
        stocksBySucursal: stocksBySucursal,
        image: p?.imagenesProducto[0]?.url,
        images: p?.imagenesProducto,
      };
    });
  }

  normalizerProductPresentacionInventario(
    arrayProductos: PresentacionWithSelect[],
  ): ProductoInventarioResponse[] {
    return (arrayProductos ?? []).map((p) => {
      // precios
      const precios: PrecioProductoNormalized[] = (p.precios ?? []).map(
        (pr) => ({
          id: pr.id,
          orden: pr.orden,
          precio: pr.precio?.toString?.() ?? '0',
          rol: pr.rol,
          tipo: pr.tipo,
        }),
      );

      // stocks crudos
      const stockPres = p.stockPresentaciones ?? [];
      const stocks: StocksProducto[] = stockPres.map((s) => ({
        id: s.id,
        cantidad: Number(s.cantidadPresentacion ?? 0),
        fechaIngreso: s.fechaIngreso
          ? dayjs(s.fechaIngreso).format('DD-MM-YYYY')
          : '',
        fechaVencimiento: s.fechaVencimiento
          ? dayjs(s.fechaVencimiento).format('DD-MM-YYYY')
          : '',
      }));

      // stocks por sucursal (ojo con s.sucursal null)
      const dict = stockPres.reduce<Record<string, StockPorSucursal>>(
        (acc, s) => {
          const sucursalId = s.sucursal?.id ?? 0; // <- antes accedías sin "?"
          const key = String(sucursalId);
          const nombre = s.sucursal?.nombre ?? key;
          const item = acc[key] ?? { sucursalId, nombre, cantidad: 0 };
          item.cantidad += Number(s.cantidadPresentacion ?? 0);
          acc[key] = item;
          return acc;
        },
        {},
      );
      const stocksBySucursal: StocksBySucursal = Object.values(dict);

      // imágenes (pueden no existir)
      const images = p.producto?.imagenesProducto ?? [];
      const image = images[0]?.url ?? ''; // usa "" o una URL placeholder si tienes una

      return {
        id: p.id,
        nombre: p.nombre,
        codigoProducto: p.codigoBarras ?? '',
        descripcion: p.descripcion ?? '',
        precioCosto:
          p.costoReferencialPresentacion != null
            ? p.costoReferencialPresentacion.toString()
            : '0',
        tipoPresentacion: p.tipoPresentacion ?? null,
        precios,
        stocks,
        stocksBySucursal,
        image,
        images, // mantén arreglo completo para el front; caerá en []
      };
    });
  }

  //SEEED
  async seedProductosBasicos(creadoPorId: number) {
    const report: Array<{
      codigoProducto: string;
      status: 'created' | 'skipped' | 'error';
      error?: string;
    }> = [];

    for (const base of itemsBase) {
      // Idempotencia por codigoProducto
      const exists = await this.prisma.producto.findUnique({
        where: { codigoProducto: base.codigoProducto },
        select: { id: true },
      });

      if (exists) {
        report.push({ codigoProducto: base.codigoProducto, status: 'skipped' });
        continue;
      }

      try {
        await this.create(
          {
            ...base,
            creadoPorId,
            precioCostoActual:
              base.precioCostoActual != null
                ? String(base.precioCostoActual)
                : undefined,
          },
          [], // sin imágenes de PRODUCTO
          new Map(), // sin imágenes de PRESENTACIONES
        );
        report.push({ codigoProducto: base.codigoProducto, status: 'created' });
      } catch (e: any) {
        this.logger.error(
          `Error creando ${base.codigoProducto}: ${e?.message ?? e}`,
        );
        report.push({
          codigoProducto: base.codigoProducto,
          status: 'error',
          error: e?.message ?? String(e),
        });
      }
    }

    const summary = {
      created: report.filter((r) => r.status === 'created').length,
      skipped: report.filter((r) => r.status === 'skipped').length,
      errors: report.filter((r) => r.status === 'error').length,
      details: report,
    };

    return summary;
  }
}
