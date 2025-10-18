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
import {
  CreateNewProductDto,
  PresentacionCreateDto,
} from './dto/create-productNew.dto';
import {
  AnyFilesInterceptor,
  FileFieldsInterceptor,
} from '@nestjs/platform-express';
import { join } from 'path';
import { RolPrecio, TipoEmpaque } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validateOrReject } from 'class-validator';
import { QueryParamsInventariado } from './query/query';
import { newQueryDTO } from './query/newQuery';

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
const mapPrecioPresentacionArray = (
  arr: any[],
  label: string,
): PrecioPresentacionDto[] =>
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

export function mapPresentacionesArray(arr: any[]): PresentacionCreateDto[] {
  return (arr ?? []).map((p, i) => ({
    nombre: cleanStr(p?.nombre),
    codigoBarras: cleanStr(p?.codigoBarras) || undefined,
    esDefault: !!p?.esDefault,

    tipoPresentacion: p?.tipoPresentacion,
    costoReferencialPresentacion: toDecimalStringOrNull(
      p?.costoReferencialPresentacion,
      `presentaciones[${i}].costoReferencialPresentacion`,
    )!, // no debe ser null

    // 👇 NUEVOS (ya los mandas desde el FE)
    descripcion: cleanStr(p?.descripcion) || null,
    stockMinimo: toNullableInt(p?.stockMinimo),

    preciosPresentacion: mapPrecioPresentacionArray(
      Array.isArray(p?.preciosPresentacion) ? p?.preciosPresentacion : [],
      `presentaciones[${i}].preciosPresentacion`,
    ),
  }));
}

@Controller('products')
export class ProductsController {
  private readonly logger = new Logger(ProductsController.name);
  constructor(private readonly productsService: ProductsService) {}
  //CREAR

  @Post()
  @UseInterceptors(
    AnyFilesInterceptor({
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async create(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() body: Record<string, any>,
  ) {
    // ---- 1) Parseo/normalizado (igual que ya lo tienes) ----
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

      // Asegúrate que tu mapper conserve descripcion y stockMinimo
      presentaciones: mapPresentacionesArray(
        safeJsonParse<any[]>(body.presentaciones, [], 'presentaciones'),
      ),
    };

    // 🔒 Validación
    const dto = plainToInstance(CreateNewProductDto, dtoPlain);
    await validateOrReject(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    // Regla: solo 1 default
    const defaults = (dto.presentaciones ?? []).filter(
      (p) => p.esDefault,
    ).length;
    if (defaults > 1) {
      throw new BadRequestException(
        'Solo puede haber una presentación por defecto',
      );
    }

    // ---- 2) ARCHIVOS: ahora files es un ARRAY, filtra por fieldname ----

    for (const f of files) {
      this.logger.debug(
        `file field=${f.fieldname} name=${f.originalname} type=${f.mimetype}`,
      );
    }

    // a) Imágenes del PRODUCTO
    const productImages = files.filter((f) => f.fieldname === 'images');

    // b) Imágenes por PRESENTACIÓN: presentaciones[<idx>].images
    const presImages = new Map<number, Express.Multer.File[]>();
    for (const f of files) {
      const m = /^presentaciones\[(\d+)\]\.images$/.exec(f.fieldname);
      if (m) {
        const idx = Number(m[1]);
        if (!presImages.has(idx)) presImages.set(idx, []);
        presImages.get(idx)!.push(f);
      }
    }

    // ---- 3) Service (pasa ambas colecciones) ----
    return this.productsService.create(dto, productImages, presImages);
  }

  /**
   * FUNCION PARA RETORNO DE PRODUCTOS Y PRESENTACIONES EN EL UI (REFACTOR, CON BUSUQUEDA Y FILTROS)
   * @param id
   * @returns
   */
  @Get('get-products-presentations-for-pos')
  async findAllProductToSale(
    @Query(
      new ValidationPipe({
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    )
    dto: newQueryDTO,
  ) {
    return await this.productsService.getProductPresentationsForPOS(dto);
  }

  /**
   * FUNCION QUE RETORNA Y FETCHEA PRODUCTOS-PRESENTACIONES AL INVENTARIO GENERAL
   * @param dto
   * @returns
   */
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

  //SEED

  /**
   * Ejecuta el seed de 20 productos.
   * Ejemplo:
   *   GET /seed/productos-basicos-gt?creadoPorId=1
   */
  @Get('productos-basicos-gt')
  async run(@Query('creadoPorId', ParseIntPipe) creadoPorId = '1') {
    const uid = Number(creadoPorId) || 1;
    return this.productsService.seedProductosBasicos(uid);
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
