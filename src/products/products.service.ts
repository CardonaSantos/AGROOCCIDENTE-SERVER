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
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.locale('es');

const toDecimal = (value: string | number) => {
  return new Prisma.Decimal(value);
};

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
  async create(dto: CreateNewProductDto, imagenes: Express.Multer.File[]) {
    try {
      // const { presentacion } = dto;
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
      this.logger.log('Data para crear un producto:', JSON.stringify(dto));

      return await this.prisma.$transaction(async (tx) => {
        const newProduct = await tx.producto.create({
          data: {
            precioCostoActual: parseInt(precioCostoActual),
            codigoProducto: codigoProducto,
            codigoProveedor: codigoProveedor,
            nombre: nombre,
            descripcion: descripcion,
            categorias: {
              connect: categorias?.map((id) => ({ id })) ?? [],
            },
          },
        });

        const preciosCreados = await Promise.all(
          dto.precioVenta.map((precio) =>
            tx.precioProducto.create({
              data: {
                productoId: newProduct.id,
                precio: precio.precio,
                estado: 'APROBADO',
                tipo: 'ESTANDAR',
                creadoPorId: dto.creadoPorId,
                fechaCreacion: new Date(),
                orden: precio.orden,
                rol: precio.rol,
              },
            }),
          ),
        );

        if (dto.stockMinimo != null) {
          this.logger.debug(
            'entrando ala creacion de stock minimo, el producto a añadirle es: ',
            newProduct,
          );

          await tx.stockThreshold.create({
            data: {
              productoId: newProduct.id,
              stockMinimo: dto.stockMinimo,
            },
          });
          this.logger.debug('Lumbra de stock minimo creado');
        }

        if (!imagenes?.length) {
          this.logger.debug('No hay imágenes para subir o crear');
        } else {
          const promesas = imagenes.map((bufferImagen) =>
            this.cloudinaryService.subirImagenFile(bufferImagen),
          );

          const resultados = await Promise.allSettled(promesas);

          for (let idx = 0; idx < resultados.length; idx++) {
            const res = resultados[idx];
            const imagenBuffer = imagenes[idx];
            if (res.status === 'fulfilled') {
              const { url, public_id } = res.value;
              console.log(`OK: Imagen ${idx} subida → ${url}`);
              await this.vincularProductoImagen(
                tx,
                newProduct.id,
                url,
                public_id,
              );
            } else {
              this.logger.error(
                `Error subiendo imagen [${idx}] (${imagenBuffer}):`,
                res.reason,
              );
            }
          }
        }

        const presentacionesValidas = presentaciones.every((p) => {
          if (typeof p.codigoBarras !== 'string' || p.codigoBarras === '')
            return false;
          if (typeof p.esDefault !== 'boolean') return false;

          if (typeof p.nombre !== 'string' || p.nombre === '') return false;

          const preciosValidos = p.preciosPresentacion.every((precio) => {
            if (precio.orden <= 0) return false;
            if (toDecimal(precio.precio).lte(0)) return false;
            const RolesPrecios = Object.values(RolPrecio) as RolPrecio[];
            if (!RolesPrecios.includes(precio.rol)) return false;

            return true;
          });

          if (!preciosValidos) return false;

          return true;
        });

        if (!presentacionesValidas) {
          throw new BadRequestException(
            'Alguna presentación tiene un formato no válido',
          );
        }

        await this.presentacionPrducto.create(
          tx,
          presentaciones,
          newProduct.id,
        );

        return { newProduct, preciosCreados };
      });
    } catch (error) {
      this.logger.error('Error al crear producto con threshold:', error);
      throw new InternalServerErrorException(
        'No se pudo crear el producto y su stock mínimo',
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
        altTexto,
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

      if (sucursalId) {
        where.stock = {
          some: {
            sucursalId: sucursalId,
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

      if (sucursalId) {
        wherePresentaciones.stockPresentaciones = {
          some: {
            sucursalId: sucursalId,
          },
        };
      }

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
        image: p.imagenesProducto[0].url,
        images: p.imagenesProducto,
      };
    });
  }

  normalizerProductPresentacionInventario(
    arrayProductos: PresentacionWithSelect[],
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
      const stocks: StocksProducto[] = (p.stockPresentaciones ?? []).map(
        (s) => ({
          id: s.id,
          cantidad: Number(s.cantidadPresentacion ?? 0),
          fechaIngreso: s.fechaIngreso
            ? dayjs(s.fechaIngreso).format('DD-MM-YYYY')
            : '',
          fechaVencimiento: s.fechaVencimiento
            ? dayjs(s.fechaVencimiento).format('DD-MM-YYYY')
            : '',
        }),
      );

      //retorno un objeto con RECORD personalizado
      const dict = (p.stockPresentaciones ?? []).reduce<
        Record<string, StockPorSucursal>
      >((acc, s) => {
        const sucursalId = s.sucursal.id ?? 0;
        const key = String(sucursalId);
        const nombre = s.sucursal?.nombre ?? key;
        //existe? sino nuevo
        const item = acc[key] ?? {
          sucursalId: sucursalId,
          nombre: nombre,
          cantidad: 0,
        };
        item.cantidad += Number(s.cantidadPresentacion ?? 0);
        acc[key] = item;
        return acc;
      }, {});
      const stocksBySucursal: StocksBySucursal = Object.values(dict);

      return {
        id: p.id,
        nombre: p.nombre,
        codigoProducto: p.codigoBarras ?? '',
        descripcion: 'PRESENTACION',
        precioCosto:
          p.costoReferencialPresentacion != null
            ? p.costoReferencialPresentacion.toString()
            : '0',
        tipoPresentacion: p.tipoPresentacion,
        precios,
        stocks,
        stocksBySucursal: stocksBySucursal,
        image: p.producto.imagenesProducto[0].url,
        images: p.producto.imagenesProducto,
      };
    });
  }
}
