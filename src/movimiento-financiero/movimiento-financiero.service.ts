import {
  BadRequestException,
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CreateMovimientoFinancieroDto } from './dto/create-movimiento-financiero.dto';
import { UpdateMovimientoFinancieroDto } from './dto/update-movimiento-financiero.dto';
import {
  ClasificacionAdmin,
  EstadoTurnoCaja,
  MotivoMovimiento,
  Prisma,
} from '@prisma/client';
import { CrearMovimientoDto } from './dto/crear-movimiento.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { UtilitiesService } from 'src/utilities/utilities.service';
import { CreateMFUtility } from './utilities/createMFDto';
type Tx = Prisma.TransactionClient;
@Injectable()
export class MovimientoFinancieroService {
  private readonly logger = new Logger(MovimientoFinancieroService.name);
  constructor(
    private prisma: PrismaService,
    private readonly utilities: UtilitiesService,
  ) {}

  async crearMovimiento(dto: CrearMovimientoDto) {
    this.logger.debug('DTO crear movimiento:', dto);

    const { sucursalId, usuarioId, motivo, monto } = dto;
    if (!sucursalId || !usuarioId) {
      throw new BadRequestException('sucursalId y usuarioId son obligatorios');
    }
    if (monto <= 0) throw new BadRequestException('monto inválido');

    // 0) Normalizar método de pago ANTES del mapeo
    if (!dto.metodoPago) {
      if (
        motivo === 'DEPOSITO_CIERRE' ||
        motivo === 'PAGO_PROVEEDOR_BANCO' ||
        dto.motivo === 'BANCO_A_CAJA' //nuevo
      ) {
        dto.metodoPago = 'TRANSFERENCIA';
      } else {
        dto.metodoPago = dto.cuentaBancariaId ? 'TRANSFERENCIA' : 'EFECTIVO';
      }
    }

    // 1) Derivar clasificación y deltas (no toca DB)
    const { clasificacion, deltaCaja, deltaBanco } =
      this.mapMotivoToEffects(dto);
    const afectaCaja = Number(deltaCaja) !== 0;
    const afectaBanco = Number(deltaBanco) !== 0;

    if (!afectaCaja && !afectaBanco) {
      throw new BadRequestException(
        'El movimiento no afecta ni caja ni banco.',
      );
    }

    // 2) Coherencia método de pago ↔ efectos
    const esDepositoCierre =
      dto.motivo === 'DEPOSITO_CIERRE' || !!dto.esDepositoCierre;
    const esBancoACaja = dto.motivo === 'BANCO_A_CAJA';

    if (dto.metodoPago === 'EFECTIVO' && afectaBanco) {
      throw new BadRequestException('Efectivo no puede afectar banco.');
    }
    if (
      dto.metodoPago !== 'EFECTIVO' &&
      afectaCaja &&
      !(esDepositoCierre || esBancoACaja)
    ) {
      throw new BadRequestException(
        'Un movimiento no-efectivo no debe afectar caja (salvo depósito de cierre o banco→caja).',
      );
    }

    // 3) Transacción: todo lo que mire/grabe en DB va adentro
    return this.prisma.$transaction(
      async (tx: Tx) => {
        let registroCajaId: number | null = dto.registroCajaId ?? null;
        const permitirTurnoAjeno = (dto as any).permitirTurnoAjeno === true; // opcional

        if (afectaCaja) {
          // Siempre ligar a la caja del USUARIO en esa sucursal
          if (!registroCajaId) {
            const abierto = await tx.registroCaja.findFirst({
              where: {
                sucursalId,
                usuarioInicioId: usuarioId,
                estado: EstadoTurnoCaja.ABIERTO,
                fechaCierre: null,
              },
              orderBy: { fechaApertura: 'desc' },
              select: { id: true },
            });
            if (!abierto) {
              throw new BadRequestException(
                'No tienes una caja abierta en esta sucursal para movimientos en efectivo.',
              );
            }
            registroCajaId = abierto.id;
          } else {
            const turno = await tx.registroCaja.findUnique({
              where: { id: registroCajaId },
              select: {
                id: true,
                estado: true,
                sucursalId: true,
                usuarioInicioId: true,
              },
            });
            if (!turno || turno.estado !== EstadoTurnoCaja.ABIERTO) {
              throw new BadRequestException(
                'Turno no encontrado o ya cerrado.',
              );
            }
            if (turno.sucursalId !== sucursalId) {
              throw new BadRequestException(
                'El turno pertenece a otra sucursal.',
              );
            }
            if (turno.usuarioInicioId !== usuarioId && !permitirTurnoAjeno) {
              throw new BadRequestException(
                'El turno no pertenece a este usuario.',
              );
            }
          }

          // candado para evitar carreras
          await tx.$executeRaw`SET LOCAL lock_timeout = '3s'`;
          await tx.$queryRaw`
                  SELECT id FROM "RegistroCaja"
                  WHERE id = ${registroCajaId}
                  FOR UPDATE NOWAIT`;
        } else {
          if (registroCajaId) {
            throw new BadRequestException(
              'Movimientos solo bancarios no deben adjuntar registroCajaId.',
            );
          }
        }

        // 3.2) Reglas de banco dentro de la transacción
        if (afectaBanco) {
          if (!dto.cuentaBancariaId) {
            throw new BadRequestException(
              'Cuenta bancaria requerida para movimientos bancarios.',
            );
          }
        } else {
          if (dto.cuentaBancariaId) {
            throw new BadRequestException(
              'No envíes cuenta bancaria si el movimiento no afecta banco.',
            );
          }
        }

        // 3.3) Reglas especiales
        if (esDepositoCierre) {
          if (!(deltaCaja < 0 && deltaBanco > 0)) {
            throw new BadRequestException(
              'Depósito de cierre debe mover caja(-) y banco(+).',
            );
          }
          if (!registroCajaId) {
            throw new BadRequestException(
              'Depósito de cierre requiere turno de caja.',
            );
          }
          if (!dto.cuentaBancariaId) {
            throw new BadRequestException(
              'Depósito de cierre requiere cuenta bancaria de destino.',
            );
          }
        }

        if (esBancoACaja) {
          if (!(deltaCaja > 0 && deltaBanco < 0)) {
            throw new BadRequestException(
              'Banco→Caja debe mover caja(+) y banco(-).',
            );
          }
          if (!registroCajaId) {
            throw new BadRequestException('Banco→Caja requiere turno de caja.');
          }
          if (!dto.cuentaBancariaId) {
            throw new BadRequestException(
              'Banco→Caja requiere cuenta bancaria de origen.',
            );
          }
        }

        if (dto.esDepositoProveedor) {
          if (
            !(
              afectaCaja &&
              deltaCaja < 0 &&
              !afectaBanco &&
              clasificacion === ClasificacionAdmin.COSTO_VENTA
            )
          ) {
            throw new BadRequestException(
              'Depósito a proveedor debe ser egreso de caja y costo de venta.',
            );
          }
        }

        // 3.4) PRE-GUARDS de efectivo (anti caja negativa)
        if (afectaCaja && registroCajaId) {
          await this.utilities.validarMovimientoEfectivo(
            tx,
            registroCajaId,
            Number(deltaCaja),
          );

          if (esDepositoCierre) {
            const montoAbs = Math.abs(Number(deltaCaja)); // deltaCaja < 0
            await this.utilities.validarDepositoCierre(
              tx,
              registroCajaId,
              montoAbs,
            );
          }
        }

        // 3.5) Crear movimiento
        const mov = await tx.movimientoFinanciero.create({
          data: {
            sucursalId,
            registroCajaId,
            clasificacion,
            motivo,
            metodoPago: dto.metodoPago ?? null,
            deltaCaja,
            deltaBanco,
            cuentaBancariaId: dto.cuentaBancariaId ?? null,
            descripcion: dto.descripcion ?? null,
            referencia: dto.referencia ?? null,
            esDepositoCierre: !!dto.esDepositoCierre,
            esDepositoProveedor: !!dto.esDepositoProveedor,
            proveedorId: dto.proveedorId ?? null,
            gastoOperativoTipo: (dto.gastoOperativoTipo as any) ?? null,
            costoVentaTipo: (dto.costoVentaTipo as any) ?? null,
            afectaInventario: this.afectaInventario(motivo),
            usuarioId,
          },
        });

        // 3.6 check: revalidar que la caja no quedó negativa
        if (afectaCaja && registroCajaId) {
          const { enCaja } = await this.utilities.getCajaEstado(
            tx,
            registroCajaId,
          );
          if (enCaja < 0) {
            throw new Error('Caja negativa tras el movimiento; rollback.');
          }
        }

        return mov;
      },
      {
        isolationLevel: 'Serializable',
      },
    );
  }

  private mapMotivoToEffects(dto: CrearMovimientoDto) {
    const m = dto.motivo;
    const x = Number(dto.monto);

    let clasificacion: ClasificacionAdmin = ClasificacionAdmin.TRANSFERENCIA;
    let deltaCaja = 0;
    let deltaBanco = 0;

    const esEfectivo = dto.metodoPago === 'EFECTIVO';

    // helpers para DRY
    const ingreso = () => {
      if (esEfectivo) deltaCaja = +x;
      else deltaBanco = +x;
    };
    const egreso = () => {
      if (esEfectivo) deltaCaja = -x;
      else deltaBanco = -x;
    };

    switch (m) {
      case MotivoMovimiento.VENTA: {
        // Venta de contado (ingreso inmediato)
        clasificacion = ClasificacionAdmin.INGRESO; // o INGRESO_OPERATIVO si lo tienes
        ingreso();
        break;
      }

      case MotivoMovimiento.COBRO_CREDITO: {
        // Anticipos y cuotas de un crédito
        clasificacion = ClasificacionAdmin.INGRESO; // o INGRESO_OPERATIVO si existe en tu enum
        ingreso(); // ✅ +x a caja o banco según método
        break;
      }

      case MotivoMovimiento.BANCO_A_CAJA: {
        clasificacion = ClasificacionAdmin.TRANSFERENCIA;
        deltaCaja = +x; // entra efectivo a caja
        deltaBanco = -x; // sale del banco
        break;
      }

      case MotivoMovimiento.OTRO_INGRESO: {
        clasificacion = ClasificacionAdmin.INGRESO;
        ingreso();
        break;
      }

      case MotivoMovimiento.GASTO_OPERATIVO: {
        clasificacion = ClasificacionAdmin.GASTO_OPERATIVO;
        egreso();
        break;
      }

      case MotivoMovimiento.COMPRA_MERCADERIA:
      case MotivoMovimiento.COSTO_ASOCIADO: {
        clasificacion = ClasificacionAdmin.COSTO_VENTA;
        egreso();
        break;
      }

      case MotivoMovimiento.DEPOSITO_CIERRE: {
        clasificacion = ClasificacionAdmin.TRANSFERENCIA;
        deltaCaja = -x;
        deltaBanco = +x;
        break;
      }

      case MotivoMovimiento.DEPOSITO_PROVEEDOR: {
        clasificacion = ClasificacionAdmin.COSTO_VENTA;
        deltaCaja = -x;
        deltaBanco = 0;
        break;
      }

      case MotivoMovimiento.PAGO_PROVEEDOR_BANCO: {
        clasificacion = ClasificacionAdmin.COSTO_VENTA;
        deltaCaja = 0;
        deltaBanco = -x;
        break;
      }

      case MotivoMovimiento.AJUSTE_SOBRANTE: {
        clasificacion = ClasificacionAdmin.AJUSTE;
        deltaCaja = +x;
        break;
      }

      case MotivoMovimiento.AJUSTE_FALTANTE: {
        clasificacion = ClasificacionAdmin.AJUSTE;
        deltaCaja = -x;
        break;
      }

      case MotivoMovimiento.DEVOLUCION: {
        clasificacion = ClasificacionAdmin.CONTRAVENTA;
        egreso(); // devuelve dinero al cliente (caja o banco)
        break;
      }

      case MotivoMovimiento.PAGO_CREDITO: {
        // o PAGO_CXP / PAGO_PROVEEDOR
        clasificacion = ClasificacionAdmin.COSTO_VENTA;
        if (esEfectivo) deltaCaja = -x;
        else deltaBanco = -x;
        break;
      }

      default:
        throw new BadRequestException('Motivo no soportado');
    }

    // Cualquier caso que toque caja requiere turno abierto
    const necesitaTurno = deltaCaja !== 0;

    return { clasificacion, deltaCaja, deltaBanco, necesitaTurno };
  }

  private afectaInventario(motivo: MotivoMovimiento) {
    return motivo === MotivoMovimiento.COMPRA_MERCADERIA; // recepción de compra
  }

  async getMovimientosFinancierosSimple() {
    return this.prisma.movimientoFinanciero.findMany({
      include: {
        cuentaBancaria: true,
        registroCaja: true,
      },
    });
  }

  /**
   * Servicio utilitario para crear movimientos financieros
   * @param rawDto DTO PARA CREAR UN MOVIMIENTO FINANCIERO
   * @param opts Transaccion o permitir turno ajeno
   * @returns
   */
  async createMovimiento(
    rawDto: CreateMFUtility,
    opts?: { tx?: Tx; permitirTurnoAjeno?: boolean },
  ) {
    const run = async (tx: Tx) => {
      const dto = { ...rawDto };
      // A) Normalizar metodoPago (solo si falta)
      if (!dto.metodoPago) {
        if (
          dto.motivo === 'DEPOSITO_CIERRE' ||
          dto.motivo === 'PAGO_PROVEEDOR_BANCO' ||
          dto.motivo === 'BANCO_A_CAJA'
        ) {
          dto.metodoPago = 'TRANSFERENCIA';
        } else {
          dto.metodoPago = dto.cuentaBancariaId ? 'TRANSFERENCIA' : 'EFECTIVO';
        }
      }

      // B) Derivar efectos (no tocar DB)
      const { clasificacion, deltaCaja, deltaBanco } =
        this.mapMotivoToEffects(dto); // tu función existente

      const afectaCaja = Number(deltaCaja) !== 0;
      const afectaBanco = Number(deltaBanco) !== 0;

      if (!afectaCaja && !afectaBanco) {
        throw new BadRequestException(
          'El movimiento no afecta ni caja ni banco.',
        );
      }

      // C) Reglas método↔efectos
      const esDepositoCierre =
        dto.motivo === 'DEPOSITO_CIERRE' || !!dto.esDepositoCierre;
      const esBancoACaja = dto.motivo === 'BANCO_A_CAJA';

      if (dto.metodoPago === 'EFECTIVO' && afectaBanco) {
        throw new BadRequestException('Efectivo no puede afectar banco.');
      }
      if (
        dto.metodoPago !== 'EFECTIVO' &&
        afectaCaja &&
        !(esDepositoCierre || esBancoACaja)
      ) {
        throw new BadRequestException(
          'Un movimiento no-efectivo no debe afectar caja (salvo depósito de cierre o banco→caja).',
        );
      }

      // D) Resolver/validar turno de caja si aplica
      let registroCajaId = dto.registroCajaId ?? null;
      if (afectaCaja) {
        if (!registroCajaId) {
          const abierto = await tx.registroCaja.findFirst({
            where: {
              sucursalId: dto.sucursalId,
              usuarioInicioId: dto.usuarioId,
              estado: EstadoTurnoCaja.ABIERTO,
              fechaCierre: null,
            },
            orderBy: { fechaApertura: 'desc' },
            select: { id: true },
          });
          if (!abierto) {
            throw new BadRequestException(
              'No tienes una caja abierta en esta sucursal para movimientos en efectivo.',
            );
          }
          registroCajaId = abierto.id;
        } else {
          const turno = await tx.registroCaja.findUnique({
            where: { id: registroCajaId },
            select: {
              id: true,
              estado: true,
              sucursalId: true,
              usuarioInicioId: true,
            },
          });
          if (!turno || turno.estado !== EstadoTurnoCaja.ABIERTO) {
            throw new BadRequestException('Turno no encontrado o ya cerrado.');
          }
          if (turno.sucursalId !== dto.sucursalId) {
            throw new BadRequestException(
              'El turno pertenece a otra sucursal.',
            );
          }
          if (
            turno.usuarioInicioId !== dto.usuarioId &&
            !opts?.permitirTurnoAjeno
          ) {
            throw new BadRequestException(
              'El turno no pertenece a este usuario.',
            );
          }
        }

        // Lock optimista anti-carrera
        await tx.$executeRaw`SET LOCAL lock_timeout = '3s'`;
        await tx.$queryRaw`
          SELECT id FROM "RegistroCaja"
          WHERE id = ${registroCajaId}
          FOR UPDATE NOWAIT`;
      } else {
        if (dto.registroCajaId) {
          throw new BadRequestException(
            'Movimientos solo bancarios no deben adjuntar registroCajaId.',
          );
        }
      }

      // E) Reglas de banco
      if (afectaBanco) {
        if (!dto.cuentaBancariaId) {
          throw new BadRequestException(
            'Cuenta bancaria requerida para movimientos bancarios.',
          );
        }
      } else if (dto.cuentaBancariaId) {
        throw new BadRequestException(
          'No envíes cuenta bancaria si el movimiento no afecta banco.',
        );
      }

      // F) Reglas especiales
      if (esDepositoCierre) {
        if (!(deltaCaja < 0 && deltaBanco > 0)) {
          throw new BadRequestException(
            'Depósito de cierre debe mover caja(-) y banco(+).',
          );
        }
        if (!registroCajaId)
          throw new BadRequestException('Depósito de cierre requiere turno.');
        if (!dto.cuentaBancariaId) {
          throw new BadRequestException(
            'Depósito de cierre requiere cuenta bancaria destino.',
          );
        }
      }

      if (esBancoACaja) {
        if (!(deltaCaja > 0 && deltaBanco < 0)) {
          throw new BadRequestException(
            'Banco→Caja debe mover caja(+) y banco(-).',
          );
        }
        if (!registroCajaId)
          throw new BadRequestException('Banco→Caja requiere turno.');
        if (!dto.cuentaBancariaId) {
          throw new BadRequestException(
            'Banco→Caja requiere cuenta bancaria origen.',
          );
        }
      }

      if (dto.esDepositoProveedor) {
        if (
          !(
            afectaCaja &&
            deltaCaja < 0 &&
            !afectaBanco &&
            clasificacion === ClasificacionAdmin.COSTO_VENTA
          )
        ) {
          throw new BadRequestException(
            'Depósito a proveedor debe ser egreso de caja y costo de venta.',
          );
        }
      }

      // G) Pre-guards efectivo (anti caja negativa + depósito cierre válido)
      if (afectaCaja && registroCajaId) {
        await this.utilities.validarMovimientoEfectivo(
          tx,
          registroCajaId,
          Number(deltaCaja),
        );
        if (esDepositoCierre) {
          await this.utilities.validarDepositoCierre(
            tx,
            registroCajaId,
            Math.abs(Number(deltaCaja)),
          );
        }
      }
      this.logger.log('el id de la caja encontrada es: ', registroCajaId);
      // H) Crear (usar FK escalares para evitar connect indefinidos)
      const mov = await tx.movimientoFinanciero.create({
        data: {
          sucursalId: dto.sucursalId,
          usuarioId: dto.usuarioId,
          registroCajaId: registroCajaId ?? null,
          cuentaBancariaId: dto.cuentaBancariaId ?? null,
          proveedorId: dto.proveedorId ?? null,

          clasificacion,
          motivo: dto.motivo,
          metodoPago: dto.metodoPago ?? null,
          deltaCaja,
          deltaBanco,
          descripcion: dto.descripcion ?? null,
          referencia: dto.referencia ?? null,
          esDepositoCierre: !!dto.esDepositoCierre,
          esDepositoProveedor: !!dto.esDepositoProveedor,
          gastoOperativoTipo: (dto.gastoOperativoTipo as any) ?? null,
          costoVentaTipo: (dto.costoVentaTipo as any) ?? null,
          afectaInventario: this.afectaInventario(dto.motivo),
        },
      });

      // I) Re-chequeo caja
      if (afectaCaja && registroCajaId) {
        const { enCaja } = await this.utilities.getCajaEstado(
          tx,
          registroCajaId,
        );
        if (enCaja < 0)
          throw new Error('Caja negativa tras el movimiento; rollback.');
      }

      return mov;
    };

    if (opts?.tx) return run(opts.tx);
    return this.prisma.$transaction((tx) => run(tx), {
      isolationLevel: 'Serializable',
    });
  }
}
