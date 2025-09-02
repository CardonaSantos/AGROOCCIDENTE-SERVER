import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { ClienteToSelect } from './interfaces';

@Injectable()
export class ClientService {
  private readonly logger = new Logger(ClientService.name);
  constructor(private readonly prisma: PrismaService) {}

  async create(createClientDto: CreateClientDto) {
    try {
      const client = await this.prisma.cliente.create({
        data: {
          nombre: createClientDto.nombre,
          apellidos: createClientDto.apellidos,

          dpi: createClientDto.dpi,
          telefono: createClientDto.telefono,
          direccion: createClientDto.direccion,
          observaciones: createClientDto.observaciones,
        },
      });

      if (!client) {
        throw new BadRequestException('Error al crear cliente');
      }

      return client;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Error en el servidor');
    }
  }

  async Customers() {
    try {
      const clientes = await this.prisma.cliente.findMany({
        select: {
          id: true,
          nombre: true,
          apellidos: true,
          telefono: true,
          dpi: true,
          direccion: true,
          observaciones: true,
          actualizadoEn: true,
          _count: {
            select: {
              compras: true,
            },
          },
        },
        orderBy: {
          creadoEn: 'desc',
        },
      });

      if (!clientes) {
        throw new InternalServerErrorException('Error');
      }

      return clientes;
    } catch (error) {
      console.log(error);
      throw new BadRequestException('Error al encontrar los clientes');
    }
  }

  async findCustomersToWarranty() {
    try {
      const customers = await this.prisma.cliente.findMany({
        orderBy: {
          creadoEn: 'desc',
        },
      });

      return customers;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Error al encontrar customers');
    }
  }

  async update(id: number, updateClientDto: UpdateClientDto) {
    try {
      const userUpdated = await this.prisma.cliente.update({
        where: {
          id: id,
        },
        data: {
          nombre: updateClientDto.nombre,
          apellidos: updateClientDto.apellidos,
          telefono: updateClientDto.telefono,
          direccion: updateClientDto.direccion,
          dpi: updateClientDto.dpi,
          observaciones: updateClientDto.observaciones,
        },
      });

      return userUpdated;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Error al editar cliente');
    }
  }

  async removeAll() {
    try {
      const clientes = await this.prisma.cliente.deleteMany({});
      return clientes;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Error');
    }
  }

  async remove(id: number) {
    try {
      const userToDelete = await this.prisma.cliente.delete({
        where: {
          id,
        },
      });
      return userToDelete;
    } catch (error) {
      console.log(error);
      throw new BadRequestException('Error al intentar eliminar el cliente');
    }
  }

  async getClientToCredit() {
    try {
      const customers = await this.prisma.cliente.findMany({
        select: {
          id: true,
          nombre: true,
          telefono: true,
          dpi: true,
          creadoEn: true,
        },
        orderBy: {
          creadoEn: 'desc',
        },
      });
      return customers;
    } catch (error) {
      console.log(error);
      throw new BadRequestException('Error al conseguir customers');
    }
  }

  async getClientesToSelect(): Promise<ClienteToSelect[]> {
    try {
      const clientes = await this.prisma.cliente.findMany({
        select: {
          id: true,
          nombre: true,
          apellidos: true,
          actualizadoEn: true,
          creadoEn: true,
          telefono: true,
          observaciones: true,
        },
      });

      const formattClientes = clientes.map((c) => ({
        id: c.id,
        nombre: c.nombre,
        apellidos: c.apellidos,
        observaciones: c.observaciones,
        telefono: c.telefono,
        creadoEn: c.creadoEn,
        actualizadoEn: c.actualizadoEn,
      }));

      return formattClientes;
    } catch (error) {
      this.logger.error(
        'El error generado en get clientes to select es: ',
        error,
      );
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'Fatal error: Error inesperado en modulo clientes',
      );
    }
  }
}
