import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateCategoriaDto } from './dto/create-categoria.dto';
import { UpdateCategoriaDto } from './dto/update-categoria.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class CategoriaService {
  //
  constructor(private readonly prisma: PrismaService) {}
  async create(createCategoriaDto: CreateCategoriaDto) {
    try {
      console.log('La data para el create es: ', createCategoriaDto);
      const { nombre } = createCategoriaDto;
      const categoria = await this.prisma.categoria.create({
        data: {
          nombre: nombre,
        },
      });
      return categoria;
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Error al crear la categoria');
    }
  }

  async findAll() {
    try {
      const categorias = await this.prisma.categoria.findMany({});

      return categorias.map((c) => ({
        id: c.id,
        nombre: c.nombre,
      }));
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Error al obtener las categorias');
    }
  }

  async findOne(id: number) {
    try {
      const categoria = await this.prisma.categoria.findUnique({
        where: { id },
      });
      if (!categoria) {
        throw new NotFoundException(`Categoria con ID ${id} no encontrada`);
      }
      return categoria;
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Error al encontrar la categoria');
    }
  }

  async update(id: number, updateCategoriaDto: UpdateCategoriaDto) {
    try {
      console.log('La data llegando a actualizar es: ', updateCategoriaDto);

      const categoria = await this.prisma.categoria.update({
        where: { id },
        data: {
          nombre: updateCategoriaDto.nombre,
        },
      });
      if (!categoria) {
        throw new NotFoundException(`Categoria con ID ${id} no encontrada`);
      }
      console.log('La categoria editada es: ', categoria);

      return categoria;
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException(
        'Error al actualizar la categoria',
      );
    }
  }

  async removeAll() {
    try {
      const categorias = await this.prisma.categoria.deleteMany({});
      return categorias;
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException(
        'Error al eliminar las categorias',
      );
    }
  }

  async remove(id: number) {
    try {
      const categoria = await this.prisma.categoria.delete({
        where: { id },
      });
      if (!categoria) {
        throw new NotFoundException(`Categoria con ID ${id} no encontrada`);
      }
      console.log('La categoria elimnada es: ', categoria);

      return categoria;
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Error al eliminar la categoria');
    }
  }

  //nuevo
  async findOneWithCount(id: number) {
    const cat = await this.prisma.categoria.findUnique({
      where: { id },
      select: {
        id: true,
        nombre: true,
        _count: { select: { productos: true } },
      },
    });
    if (!cat) throw new NotFoundException(`Categoria ${id} no encontrada`);

    return {
      id: cat.id,
      nombre: cat.nombre,
      productosCount: cat._count.productos,
    };
  }

  async findAllWithCounts() {
    const cats = await this.prisma.categoria.findMany({
      select: {
        id: true,
        nombre: true,
        _count: { select: { productos: true } }, // <-- relación
      },
      orderBy: { id: 'asc' },
    });

    return cats.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      productosCount: c._count.productos,
    }));
  }
}
