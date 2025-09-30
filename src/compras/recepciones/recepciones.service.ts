import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateRecepcioneDto } from './dto/create-recepcione.dto';
import { UpdateRecepcioneDto } from './dto/update-recepcione.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { TransferenciaProductoService } from 'src/transferencia-producto/transferencia-producto.service';
import { ComprasRegistrosQueryDto } from 'src/compras-requisiciones/dto/compras-registros.query.dto';
import {
  CompraDetalleUI,
  CompraRecepcionesParcialesUI,
  CompraResumenUI,
  ItemMinUI,
  RecepcionLineaFlatUI,
  RecepcionLineaUI,
  RecepcionParcialUI,
  UsuarioMinUI,
} from './interface/interfacesResponse';

@Injectable()
export class RecepcionesService {
  private readonly logger = new Logger(RecepcionesService.name);
  constructor(private readonly prisma: PrismaService) {}

  create(createRecepcioneDto: CreateRecepcioneDto) {
    return 'This action adds a new recepcione';
  }

  async getRecepcionesCompraParcial(
    compraId: number,
  ): Promise<CompraRecepcionesParcialesUI> {
    try {
      if (!compraId || !Number.isFinite(compraId)) {
        throw new BadRequestException('ID de compra no válido');
      }

      const compra = await this.prisma.compra.findUnique({
        where: { id: compraId },
        select: {
          id: true,
          fecha: true,
          creadoEn: true,
          actualizadoEn: true,
          estado: true,
          origen: true,
          conFactura: true,
          total: true,
          usuario: { select: { id: true, nombre: true, correo: true } },
          // Traemos detalles para poder calcular acumulados/pedidos
          detalles: {
            select: {
              id: true,
              cantidad: true,
              costoUnitario: true,
              creadoEn: true,
              actualizadoEn: true,
              // Normalización: producto o presentacion
              producto: {
                select: {
                  id: true,
                  nombre: true,
                  codigoProducto: true,
                  imagenesProducto: { select: { url: true }, take: 1 },
                  categorias: { select: { nombre: true } },
                },
              },
              presentacion: {
                select: {
                  id: true,
                  nombre: true,
                  codigoBarras: true,
                  // para recuperar imagen/categorías del producto base
                  producto: {
                    select: {
                      id: true,
                      nombre: true,
                      codigoProducto: true,
                      imagenesProducto: { select: { url: true }, take: 1 },
                      categorias: { select: { nombre: true } },
                    },
                  },
                },
              },
            },
          },
          recepciones: {
            orderBy: { fecha: 'asc' },
            select: {
              id: true,
              fecha: true,
              createdAt: true,
              updatedAt: true,
              observaciones: true,
              usuario: {
                select: { id: true, nombre: true, correo: true, rol: true },
              },
              lineas: {
                select: {
                  id: true,
                  createdAt: true,
                  updatedAt: true,
                  cantidadRecibida: true,
                  fechaExpiracion: true,
                  compraDetalleId: true,
                  compraDetalle: {
                    select: {
                      id: true,
                      cantidad: true,
                      costoUnitario: true,
                      producto: {
                        select: {
                          id: true,
                          nombre: true,
                          codigoProducto: true,
                          imagenesProducto: { select: { url: true }, take: 1 },
                          categorias: { select: { nombre: true } },
                        },
                      },
                      presentacion: {
                        select: {
                          id: true,
                          nombre: true,
                          codigoBarras: true,
                          producto: {
                            select: {
                              id: true,
                              nombre: true,
                              codigoProducto: true,
                              imagenesProducto: {
                                select: { url: true },
                                take: 1,
                              },
                              categorias: { select: { nombre: true } },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!compra) {
        throw new NotFoundException('Compra no encontrada');
      }

      // ---------- Helpers de normalización ----------
      const toUsuarioMin = (u: any): UsuarioMinUI => ({
        id: u.id,
        nombre: u.nombre,
        correo: u.correo,
        rol: 'rol' in u ? u.rol : undefined,
      });

      const buildItemFromDetalle = (detalle: any): ItemMinUI => {
        if (detalle.presentacion) {
          const p = detalle.presentacion;
          const base = p.producto;
          return {
            itemTipo: 'PRESENTACION',
            itemId: p.id,
            productoId: base?.id ?? 0,
            nombre: p.nombre ?? base?.nombre ?? '',
            codigo: p.codigoBarras ?? base?.codigoProducto ?? null,
            imagenUrl: base?.imagenesProducto?.[0]?.url ?? null,
            categorias: base?.categorias?.map((c: any) => c.nombre) ?? [],
          };
        }
        // Caso producto
        const prod = detalle.producto ?? {};
        return {
          itemTipo: 'PRODUCTO',
          itemId: prod.id ?? 0,
          productoId: prod.id ?? 0,
          nombre: prod.nombre ?? '',
          codigo: prod.codigoProducto ?? null,
          imagenUrl: prod.imagenesProducto?.[0]?.url ?? null,
          categorias: prod.categorias?.map((c: any) => c.nombre) ?? [],
        };
      };

      const buildItemFromLinea = (linea: any): ItemMinUI => {
        // reaprovechamos la misma lógica leyendo del compraDetalle de la línea
        return buildItemFromDetalle(linea.compraDetalle);
      };

      // ---------- Acumulados por detalle ----------
      const recibidoPorDetalle = new Map<number, number>(); // compraDetalleId -> recibido
      for (const r of compra.recepciones) {
        for (const l of r.lineas) {
          const prev = recibidoPorDetalle.get(l.compraDetalleId) ?? 0;
          recibidoPorDetalle.set(
            l.compraDetalleId,
            prev + (l.cantidadRecibida ?? 0),
          );
        }
      }

      // ---------- Mapear detalles de la compra con acumulados ----------
      const detallesUI: CompraDetalleUI[] = compra.detalles.map((d: any) => {
        const item = buildItemFromDetalle(d);
        const recibido = recibidoPorDetalle.get(d.id) ?? 0;
        const pendiente = Math.max(0, (d.cantidad ?? 0) - recibido);
        return {
          detalleId: d.id,
          item,
          cantidadOrdenada: d.cantidad,
          costoUnitario: d.costoUnitario,
          recibidoAcumulado: recibido,
          pendiente,
          creadoEn: new Date(d.creadoEn).toISOString(),
          actualizadoEn: new Date(d.actualizadoEn).toISOString(),
        };
      });

      // ---------- Mapear recepciones y líneas ----------
      const recepcionesUI: RecepcionParcialUI[] = compra.recepciones.map(
        (r: any) => {
          const lineas: RecepcionLineaUI[] = r.lineas.map((l: any) => {
            const item = buildItemFromLinea(l);
            const det = l.compraDetalle;
            return {
              lineaId: l.id,
              compraDetalleId: l.compraDetalleId,
              item,
              cantidadRecibida: l.cantidadRecibida,
              costoUnitario: det.costoUnitario,
              cantidadOrdenada: det.cantidad,
              fechaExpiracion: l.fechaExpiracion
                ? new Date(l.fechaExpiracion).toISOString()
                : null,
              createdAt: new Date(l.createdAt).toISOString(),
              updatedAt: new Date(l.updatedAt).toISOString(),
            };
          });

          const unidadesRecibidas = lineas.reduce(
            (acc, li) => acc + (li.cantidadRecibida ?? 0),
            0,
          );

          return {
            recepcionId: r.id,
            fecha: new Date(r.fecha).toISOString(),
            usuario: toUsuarioMin(r.usuario),
            observaciones: r.observaciones ?? null,
            totales: {
              lineas: lineas.length,
              unidadesRecibidas,
            },
            lineas,
          };
        },
      );

      // ---------- Vista plana (útil para tablas) ----------
      const lineasFlat: RecepcionLineaFlatUI[] = [];
      for (const r of recepcionesUI) {
        for (const l of r.lineas) {
          lineasFlat.push({
            recepcionId: r.recepcionId,
            recepcionFecha: r.fecha,
            lineaId: l.lineaId,
            compraDetalleId: l.compraDetalleId,
            item: l.item,
            cantidadOrdenada: l.cantidadOrdenada,
            cantidadRecibida: l.cantidadRecibida,
            costoUnitario: l.costoUnitario,
            usuario: r.usuario,
            observaciones: r.observaciones ?? null,
            createdAt: l.createdAt,
            updatedAt: l.updatedAt,
          });
        }
      }

      // ---------- Totales de cabecera ----------
      const unidadesOrdenadas = detallesUI.reduce(
        (acc, d) => acc + d.cantidadOrdenada,
        0,
      );
      const unidadesRecibidas = detallesUI.reduce(
        (acc, d) => acc + d.recibidoAcumulado,
        0,
      );
      const unidadesPendientes = detallesUI.reduce(
        (acc, d) => acc + d.pendiente,
        0,
      );

      const compraUI: CompraResumenUI = {
        id: compra.id,
        fecha: new Date(compra.fecha ?? compra.creadoEn).toISOString(),
        estado: compra.estado,
        origen: compra.origen,
        conFactura: compra.conFactura,
        total: compra.total,
        usuario: toUsuarioMin(compra.usuario),
        totales: {
          lineasOrdenadas: detallesUI.length,
          unidadesOrdenadas,
          unidadesRecibidas,
          unidadesPendientes,
          recepcionesCount: recepcionesUI.length,
        },
        detalles: detallesUI,
      };

      return {
        compra: compraUI,
        recepciones: recepcionesUI,
        lineasFlat,
      };
    } catch (error) {
      this.logger.error(
        'Error generado en módulo recepciones parciales: ',
        (error as any)?.stack,
      );
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'Fatal error: Error inesperado en recepciones',
      );
    }
  }

  async getTest() {
    this.logger.log('TEST');
  }
}
