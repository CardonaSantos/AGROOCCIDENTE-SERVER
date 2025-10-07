import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  UploadedFiles,
  UseInterceptors,
  BadRequestException,
  Logger,
  HttpException,
  InternalServerErrorException,
  Query,
  ValidationPipe,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateNewProductDto } from './dto/create-productNew.dto';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { join } from 'path';
import { RolPrecio, TipoEmpaque } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validateOrReject } from 'class-validator';
import { QueryParamsInventariado } from './query/query';

// ---- DTOS del payload que esperas en tu servicio ----
interface PrecioProductoDto {
  rol: RolPrecio;
  orden: number;
  precio: string; // decimal string
}

interface PrecioPresentacionDto {
  rol: RolPrecio;
  orden: number;
  precio: string; // decimal string
}

interface PresentacionDto {
  nombre: string;
  factorUnidadBase: string; // decimal string
  sku?: string | null;
  codigoBarras?: string | null;
  esDefault?: boolean;
  preciosPresentacion: PrecioPresentacionDto[];
  tipoPresentacion: TipoEmpaque;
  costoReferencialPresentacion: string;
}

// -------- Helpers de parsing/validación --------
const isDecimalStr = (s: string) => /^\d+(\.\d+)?$/.test(s);
const cleanStr = (v: unknown) =>
  v === undefined || v === null ? '' : String(v).trim();

const toNullableInt = (v: unknown) => {
  const s = cleanStr(v);
  if (!s || s.toLowerCase() === 'null') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

const toIntOrThrow = (v: unknown, label: string) => {
  const n = Number(v);
  if (!Number.isInteger(n)) {
    throw new BadRequestException(`${label} debe ser entero`);
  }
  return n;
};

const toBool = (v: unknown) => {
  const s = cleanStr(v).toLowerCase();
  return s === 'true' || s === '1' || s === 'on';
};

const toDecimalStringOrNull = (v: unknown, label: string) => {
  const s = cleanStr(v);
  if (!s || s.toLowerCase() === 'null') return null;
  if (!isDecimalStr(s)) {
    throw new BadRequestException(`${label} debe ser decimal positivo`);
  }
  return s;
};

const safeJsonParse = <T>(raw: unknown, fallback: T, label: string): T => {
  const s = cleanStr(raw);
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    throw new BadRequestException(`${label} tiene un JSON inválido`);
  }
};

const mapPrecioProductoArray = (
  arr: any[],
  label: string,
): PrecioProductoDto[] =>
  (Array.isArray(arr) ? arr : []).map((p, i) => {
    const idx = `${label}[${i}]`;
    const rol = cleanStr(p?.rol) as RolPrecio;
    const orden = toIntOrThrow(p?.orden, `${idx}.orden`);
    const precioStr = cleanStr(p?.precio);
    if (!isDecimalStr(precioStr)) {
      throw new BadRequestException(`${idx}.precio debe ser decimal positivo`);
    }
    return { rol, orden, precio: precioStr };
  });

const mapPresentacionesArray = (arr: any[]): PresentacionDto[] =>
  (Array.isArray(arr) ? arr : []).map((pr, i) => {
    const idx = `presentaciones[${i}]`;
    const nombre = cleanStr(pr?.nombre);
    if (!nombre) throw new BadRequestException(`${idx}.nombre es requerido`);

    const factor = cleanStr(pr?.factorUnidadBase);
    if (!isDecimalStr(factor)) {
      throw new BadRequestException(
        `${idx}.factorUnidadBase debe ser decimal positivo`,
      );
    }

    //precios de las presentaciones
    const precios = mapPrecioProductoArray(
      pr?.preciosPresentacion ?? [],
      `${idx}.preciosPresentacion`,
    );

    // Validate tipoPresentacion
    const tipoPresentacion = pr?.tipoPresentacion;
    if (!tipoPresentacion) {
      throw new BadRequestException(`${idx}.tipoPresentacion es requerido`);
    }

    // Validate costoReferencialPresentacion
    const costoReferencialPresentacion = cleanStr(
      pr?.costoReferencialPresentacion,
    );
    if (!isDecimalStr(costoReferencialPresentacion)) {
      throw new BadRequestException(
        `${idx}.costoReferencialPresentacion debe ser decimal positivo`,
      );
    }

    return {
      nombre,
      factorUnidadBase: factor,
      sku: cleanStr(pr?.sku) || null,
      codigoBarras: cleanStr(pr?.codigoBarras) || null,
      esDefault: !!pr?.esDefault, // ya viene boolean del front; si viniera string: toBool(pr?.esDefault)
      preciosPresentacion: precios,
      tipoPresentacion: tipoPresentacion,
      costoReferencialPresentacion: costoReferencialPresentacion,
    };
  });

@Controller('products')
export class ProductsController {
  private readonly logger = new Logger(ProductsController.name);
  constructor(private readonly productsService: ProductsService) {}
  //CREAR

  @Post()
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'images', maxCount: 10 }], {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async create(
    @UploadedFiles() files: { images?: Express.Multer.File[] },
    @Body() body: Record<string, any>,
  ) {
    // ---- 1) Parsear/normalizar primitivas ----
    this.logger.debug(
      'RAW presentaciones:',
      typeof body.presentaciones,
      body.presentaciones?.slice?.(0, 200),
    );
    const parsed = safeJsonParse<any[]>(
      body.presentaciones,
      [],
      'presentaciones',
    );
    this.logger.debug('Parsed p[0] keys:', Object.keys(parsed?.[0] ?? {}));

    const dtoPlain: Partial<CreateNewProductDto> = {
      nombre: cleanStr(body.nombre),
      descripcion: cleanStr(body.descripcion) || null,
      codigoProducto: cleanStr(body.codigoProducto),
      codigoProveedor: cleanStr(body.codigoProveedor) || null,
      stockMinimo: toNullableInt(body.stockMinimo),

      precioCostoActual: toDecimalStringOrNull(
        body.precioCostoActual,
        'precioCostoActual',
      ),

      creadoPorId: toIntOrThrow(body.creadoPorId, 'creadoPorId'),

      categorias: safeJsonParse<number[]>(body.categorias, [], 'categorias'),

      precioVenta: mapPrecioProductoArray(
        safeJsonParse<any[]>(body.precioVenta, [], 'precioVenta'),
        'precioVenta',
      ),

      presentaciones: mapPresentacionesArray(
        safeJsonParse<any[]>(body.presentaciones, [], 'presentaciones'),
      ),
    };

    // 🔒 Validación con class-validator
    const dto = plainToInstance(CreateNewProductDto, dtoPlain);
    await validateOrReject(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    // Regla de negocio adicional: 1 sola default
    const defaults = (dto.presentaciones ?? []).filter(
      (p) => p.esDefault,
    ).length;
    if (defaults > 1) {
      throw new BadRequestException(
        'Solo puede haber una presentación por defecto',
      );
    }

    const imagenes = files.images ?? [];

    return this.productsService.create(dto, imagenes);
  }

  @Get('/sucursal/:id')
  async findAllProductToSale(@Param('id', ParseIntPipe) id: number) {
    return await this.productsService.findAllProductsToSale(id);
  }
  // findAllProductsToSale
  //ENCONTRAR TODAS PARA INVENTARIADO
  // @Get('/products/for-inventary')
  // async findAll() {
  //   return await this.productsService.findAll();
  // }

  @Get('/products/for-inventary')
  async getAll(
    @Query(
      new ValidationPipe({
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    )
    dto: QueryParamsInventariado,
  ) {
    return await this.productsService.getProductosPresentacionesForInventary(
      dto,
    );
  }

  @Get('/products/to-transfer/:id')
  async findAllProductsToTransfer(@Param('id', ParseIntPipe) id: number) {
    return await this.productsService.findAllProductsToTransfer(id);
  }

  @Get('/products/for-set-stock')
  async findAllProductsToStcok() {
    return await this.productsService.findAllProductsToStcok();
  }

  @Get('/product/get-one-product/:id')
  async productToEdit(@Param('id', ParseIntPipe) id: number) {
    return await this.productsService.productToEdit(id);
  }

  @Get('/products-to-credit')
  async productToCredit() {
    return await this.productsService.productToCredit();
  }

  @Get('/historial-price')
  async productHistorialPrecios() {
    return await this.productsService.productHistorialPrecios();
  }

  @Get('/product-to-warranty')
  async productToWarranty() {
    return await this.productsService.productToWarranty();
  }

  @Get('/carga-masiva')
  async makeCargaMasiva() {
    const ruta = join(process.cwd(), 'src', 'assets', 'productos_ejemplo.csv');
    // return await this.productsService.loadCSVandImportProducts(ruta);
  }

  @Get('search')
  async getBySearchProducts(
    @Query('q') q: string,
    @Query('sucursalId') sucursalId: string,
  ) {
    try {
      return await this.productsService.getBySearchProducts(q, sucursalId);
    } catch (error) {
      this.logger.error('Error generado en search productos: ', error);
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'Error inesperado al buscar productos',
      );
    }
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return await this.productsService.findOne(id);
  }

  @Patch('actualizar/producto/:id')
  @UseInterceptors(FileFieldsInterceptor([{ name: 'images', maxCount: 10 }]))
  async update(
    @Param('id') id: string,
    @UploadedFiles() files: { images?: Express.Multer.File[] },
    @Body() body: Record<string, any>,
  ) {
    const dto = new UpdateProductDto();

    // Campos simples
    dto.nombre = body.nombre;
    dto.motivoCambio = body.motivoCambio;
    dto.sucursalId = parseInt(body.sucursalId);
    dto.modificadoPorId = parseInt(body.modificadoPorId);
    dto.descripcion = body.descripcion || dto.descripcion;
    dto.codigoProducto = body.codigoProducto;
    dto.codigoProveedor = body.codigoProveedor || dto.codigoProveedor;
    dto.stockMinimo =
      body.stockMinimo != null ? Number(body.stockMinimo) : dto.stockMinimo;
    dto.precioCostoActual =
      body.precioCostoActual != null
        ? Number(body.precioCostoActual)
        : dto.precioCostoActual;

    // Arrays via JSON.parse
    dto.categorias = body.categorias
      ? JSON.parse(body.categorias)
      : dto.categorias;

    dto.precios = body.precios ? JSON.parse(body.precios) : dto.precios;

    // Convertir archivos nuevos a base64
    const nuevas = (files.images || []).map((file) => {
      const b64 = file.buffer.toString('base64');
      return `data:${file.mimetype};base64,${b64}`;
    });

    // Unir URLs previas + nuevas imágenes
    dto.imagenes = [...nuevas];

    // Llamas tu servicio con id + dto
    return this.productsService.update(Number(id), dto);
  }

  @Delete('/delete-image-from-product/:id/:imageId')
  async removeImageFromProduct(
    @Param('id') id: string,
    @Param('imageId', ParseIntPipe) imageId: number,
  ) {
    const decodedId = decodeURIComponent(id); // ← si lo necesitas en formato limpio
    return this.productsService.removeImageFromProduct(decodedId, imageId);
  }

  @Delete('/delete-all')
  async removeAll() {
    return await this.productsService.removeAll();
  }

  @Delete('/delete-one-price-from-product/:id')
  async removePrice(@Param('id', ParseIntPipe) id: number) {
    console.log('Eliminando el precio: ', id);
    return await this.productsService.removePrice(id);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return await this.productsService.remove(id);
  }
}
