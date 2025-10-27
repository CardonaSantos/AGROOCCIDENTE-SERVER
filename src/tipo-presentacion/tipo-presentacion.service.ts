import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service'; // ajusta la ruta
import { CreateTipoPresentacionDto } from './dto/create-tipo-presentacion.dto';
import { UpdateTipoPresentacionDto } from './dto/update-tipo-presentacion.dto';
import { TipoPresentacionQueryDto } from './dto/query';

type TipoEntity = {
  id: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  creadoEn: Date;
  actualizadoEn: Date;
  productos?: number;
};

type TipoRowBase = Prisma.TipoPresentacionGetPayload<{}>;
type TipoRowWithCount = Prisma.TipoPresentacionGetPayload<{
  include: { _count: { select: { productos: true } } };
}>;

type TipoRowMaybeCount = TipoRowBase & {
  _count?: {
    productos?: number;
    presentaciones?: number;
  };
};

const serialize = (t: TipoRowMaybeCount) => ({
  id: t.id,
  nombre: t.nombre,
  descripcion: t.descripcion,
  activo: t.activo,
  productos: (t._count?.productos ?? 0) + (t._count?.presentaciones ?? 0),
  fechas: {
    creadoISO: t.creadoEn.toISOString(),
    actualizadoISO: t.actualizadoEn.toISOString(),
  },
});

@Injectable()
export class TipoPresentacionService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTipoPresentacionDto) {
    try {
      const created = await this.prisma.tipoPresentacion.create({
        data: {
          nombre: dto.nombre,
          descripcion: dto.descripcion ?? null,
          activo: dto.activo ?? true,
        },
      });
      return {
        message: 'Tipo de presentación creado',
        data: serialize(created),
      };
    } catch (e) {
      if (this.isUniqueError(e, 'TipoPresentacion_nombre_key')) {
        throw new ConflictException('Ya existe un tipo con ese nombre.');
      }
      throw e;
    }
  }

  async findAll(query: TipoPresentacionQueryDto) {
    const { page = 1, limit = 20, q, activo } = query;

    const where: Prisma.TipoPresentacionWhereInput = {
      ...(q
        ? {
            OR: [
              { nombre: { contains: q, mode: 'insensitive' } },
              { descripcion: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(typeof activo === 'boolean' ? { activo } : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.tipoPresentacion.count({ where }),
      this.prisma.tipoPresentacion.findMany({
        where,
        orderBy: { creadoEn: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: {
            select: { productos: true, presentaciones: true },
          },
        },
      }),
    ]);

    return {
      data: rows.map(serialize),
      meta: {
        total,
        page,
        limit,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findOne(id: number) {
    const row = await this.prisma.tipoPresentacion.findUnique({
      where: { id },
    });
    if (!row)
      throw new NotFoundException('Tipo de presentación no encontrado.');
    return { data: serialize(row) };
  }

  async update(id: number, dto: UpdateTipoPresentacionDto) {
    try {
      const updated = await this.prisma.tipoPresentacion.update({
        where: { id },
        data: {
          ...(dto.nombre !== undefined ? { nombre: dto.nombre } : {}),
          ...(dto.descripcion !== undefined
            ? { descripcion: dto.descripcion }
            : {}),
          ...(dto.activo !== undefined ? { activo: dto.activo } : {}),
        },
      });
      return {
        message: 'Tipo de presentación actualizado',
        data: serialize(updated),
      };
    } catch (e) {
      if (this.isNotFoundError(e)) {
        throw new NotFoundException('Tipo de presentación no encontrado.');
      }
      if (this.isUniqueError(e, 'TipoPresentacion_nombre_key')) {
        throw new ConflictException('Ya existe un tipo con ese nombre.');
      }
      throw e;
    }
  }

  async softRemove(id: number) {
    try {
      const updated = await this.prisma.tipoPresentacion.update({
        where: { id },
        data: { activo: false },
      });
      return {
        message: 'Tipo de presentación desactivado',
        data: serialize(updated),
      };
    } catch (e) {
      if (this.isNotFoundError(e)) {
        throw new NotFoundException('Tipo de presentación no encontrado.');
      }
      throw e;
    }
  }

  async restore(id: number) {
    try {
      const updated = await this.prisma.tipoPresentacion.update({
        where: { id },
        data: { activo: true },
      });
      return {
        message: 'Tipo de presentación reactivado',
        data: serialize(updated),
      };
    } catch (e) {
      if (this.isNotFoundError(e)) {
        throw new NotFoundException('Tipo de presentación no encontrado.');
      }
      throw e;
    }
  }

  async hardDelete(id: number) {
    try {
      const deleted = await this.prisma.tipoPresentacion.delete({
        where: { id },
      });
      return {
        message: 'Tipo de presentación eliminado definitivamente',
        data: serialize(deleted),
      };
    } catch (e) {
      if (this.isNotFoundError(e)) {
        throw new NotFoundException('Tipo de presentación no encontrado.');
      }
      if (this.isForeignKeyError(e)) {
        throw new BadRequestException(
          'No se puede eliminar: existen presentaciones/productos que lo utilizan.',
        );
      }
      throw e;
    }
  }

  // ===== Utilidades de manejo de errores Prisma =====
  private isNotFoundError(e: any) {
    return e?.code === 'P2025';
  }
  private isUniqueError(e: any, constraint?: string) {
    return (
      e?.code === 'P2002' &&
      (!constraint || e?.meta?.target?.includes(constraint))
    );
  }
  private isForeignKeyError(e: any) {
    return e?.code === 'P2003';
  }
}
