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
import { ImagenProducto, Prisma, RolPrecio } from '@prisma/client';

import { createReadStream } from 'fs';
import * as csvParser from 'csv-parser';
import { PresentacionProductoService } from 'src/presentacion-producto/presentacion-producto.service';
import { ProductoApi } from './dto/interfacesPromise';

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
          if (
            typeof p.factorUnidadBase !== 'string' ||
            parseInt(p.factorUnidadBase) <= 0
          )
            return false;
          if (typeof p.nombre !== 'string' || p.nombre === '') return false;
          if (typeof p.sku !== 'string' || p.sku === '') return false;

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
          sku: pres.sku,
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
              sku: true,
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
          sku: pres.sku,
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

  // async loadCSVandImportProducts(
  //   filePath: string,
  //   dryRun = false,
  // ): Promise<void> {
  //   const rows: any[] = [];
  //   // 1) Cargar todas las filas en memoria (puedes ir procesándolas fila a fila si el CSV es muy grande).
  //   const stream = createReadStream(filePath).pipe(
  //     csvParser({
  //       separator: ',',
  //       mapHeaders: ({ header }) => header.replace(/^\uFEFF/, '').trim(),
  //     }),
  //   );
  //   for await (const row of stream) {
  //     rows.push(row);
  //   }
  //   console.log(`Se leyeron ${rows.length} filas del CSV.`);

  //   // 2) Procesar cada fila
  //   for (const [index, row] of rows.entries()) {
  //     // ---------------------------------------------------
  //     // 2.1) Leer los campos del CSV y hacer trim donde convenga:
  //     // ---------------------------------------------------
  //     const codigoProducto = row['codigoProducto']?.trim();
  //     const nombre = row['nombre']?.trim();
  //     const descripcion = row['descripcion']?.trim() || null;
  //     const categoriasRaw = row['categorias']?.trim() || '';
  //     const preciosVentaRaw = row['preciosVenta']?.trim() || '';
  //     const precioCostoActual = parseFloat(row['precioCostoActual']) || null;
  //     const codigoProveedor = row['codigoProveedor']?.trim() || null;
  //     // El CSV trae “stockMinimo” (umbral), pero aquí no creamos StockThreshold: lo dejamos en stand-by.
  //     const stockMinimoCsv = parseInt(row['stockMinimo'], 10) || null;

  //     // ---------------------------------------------------
  //     // 2.2) Validar campos mínimos obligatorios:
  //     // ---------------------------------------------------
  //     if (!codigoProducto || !nombre) {
  //       console.log(
  //         `Fila ${index + 1} omitida: faltan “codigoProducto” o “nombre”.`,
  //       );
  //       continue;
  //     }

  //     const categoryNames = categoriasRaw
  //       .split(',')
  //       .map((c: string) => c.trim())
  //       .filter((c: string) => c.length > 0);

  //     const categoryIds: number[] = [];
  //     for (const catName of categoryNames) {
  //       try {
  //         // Upsert: si ya existe, lo actualiza (pero no cambia nada), si no, lo crea.
  //         const categoria = await this.prisma.categoria.upsert({
  //           where: { nombre: catName },
  //           create: { nombre: catName },
  //           update: {},
  //         });
  //         categoryIds.push(categoria.id);
  //       } catch (e) {
  //         console.log(
  //           `Error subiendo categoría “${catName}” en fila ${index + 1}: ${e.message}`,
  //         );
  //       }
  //     }

  //     if (dryRun) {
  //       console.log(
  //         `[DryRun] Producto a crear: ${nombre} (${codigoProducto}), categorías: [${categoryNames.join(
  //           ', ',
  //         )}], precios: [${preciosVentaRaw}], costo: ${precioCostoActual}`,
  //       );
  //       continue;
  //     }

  //     let productoCreado;
  //     try {
  //       productoCreado = await this.prisma.producto.create({
  //         data: {
  //           codigoProducto,
  //           nombre,
  //           descripcion,
  //           precioCostoActual, // Puede ser null si no viene en el CSV
  //           codigoProveedor, // Puede ser null si no viene en el CSV
  //           // Conectar las categorías existentes/creadas:
  //           categorias: {
  //             connect: categoryIds.map((id) => ({ id })),
  //           },
  //           // NOTA: no creamos stockThreshold ni stock aquí porque el CSV no trae sucursal/fechas
  //         },
  //       });
  //       console.log(`✅ Producto creado: ${nombre} (ID ${productoCreado.id})`);
  //     } catch (e) {
  //       console.log(
  //         `❌ Error al crear Producto en fila ${index + 1}: ${e.message}`,
  //       );
  //       continue;
  //     }
  //     const preciosArray = preciosVentaRaw
  //       .split(',')
  //       .map((p: string) => parseFloat(p.trim()))
  //       .filter((p: number) => !isNaN(p) && p > 0);

  //     for (const precio of preciosArray) {
  //       try {
  //         await this.prisma.precioProducto.create({
  //           data: {
  //             productoId: productoCreado.id,
  //             precio,
  //             estado: 'APROBADO', // o ‘APROBADO’ si quieres que quede disponible de una vez
  //             usado: false,
  //             tipo: 'ESTANDAR',
  //             // creadoPorId: null,     // si quieres registrar qué usuario lo puso, puedes pasar un ID aquí
  //           },
  //         });
  //       } catch (e) {
  //         console.log(
  //           `❌ Error al crear PrecioProducto para ${productoCreado.id} con precio ${precio}: ${e.message}`,
  //         );
  //       }
  //     }

  //     // ---------------------------------------------------
  //     // 2.8) (Opcional) Si tuvieras un stock inicial en CSV (ej: campo “cantidad” y “fechaIngreso”),
  //     //      aquí harías algo como:
  //     //
  //     // await prisma.stock.create({
  //     //   data: {
  //     //     productoId: productoCreado.id,
  //     //     cantidad: cantidadInicialCsv,
  //     //     costoTotal: cantidadInicialCsv * (precioCostoActual || 0),
  //     //     fechaIngreso: new Date(),         // o guardarlo desde el CSV si existe
  //     //     precioCosto: precioCostoActual,   // o un campo separado de “costo por unidad” si vienes del CSV
  //     //     sucursalId: tuSucursalPorDefecto,  // o un valor que venga en el CSV
  //     //   },
  //     // });
  //     //
  //     // Como no tenemos esos datos en tu CSV, lo omitimos. Si luego agregas “cantidad” y “sucursalId”,
  //     // saca esta sección del comentario y adapta los campos.
  //     // ---------------------------------------------------
  //   }

  //   console.log('📦 ¡Importación de productos finalizada!');
  // }
}
