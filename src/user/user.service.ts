import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { AdminUpdateUserDto } from './dto/AdminUpdateUserDto .dto';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}
  async create(createUserDto: CreateUserDto) {
    try {
      const newUser = await this.prisma.usuario.create({
        data: {
          contrasena: createUserDto.contrasena, //ya viene hasheada
          correo: createUserDto.correo,
          nombre: createUserDto.nombre,
          rol: createUserDto.rol,
          sucursal: {
            connect: {
              id: createUserDto.sucursalId,
            },
          },
        },
      });
      return newUser;
    } catch (error) {
      console.log(error);
      throw new BadRequestException('Error al crear el usuario');
    }
  }

  async findByGmail(correo: string) {
    console.log('Al find by email debería llegar el coreo: ', correo);

    try {
      const user = await this.prisma.usuario.findFirst({
        where: {
          correo: correo,
        },
        include: {
          sucursal: {
            select: {
              id: true,
            },
          },
        },
      });

      console.log('El usuario encontrado es: ', user);

      if (!user) {
        throw new InternalServerErrorException('Error');
      }

      return user;
    } catch (error) {
      console.log(error);
      throw new BadRequestException('error al encontrar usuario');
    }
  }

  async findAll() {
    try {
      const users = await this.prisma.usuario.findMany({});
      return users;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Error al encontrar usuarios');
    }
  }

  // Encontrar usuarios simples con notificaciones
  async findAllUserWithNot() {
    try {
      const users = await this.prisma.usuario.findMany({
        include: {
          // notificacionesEnviadas: true,
          // notificacionesRecibidas: {
          //   include: {
          //     notificacionesUsuarios: true, // Incluye los detalles de la notificación
          //   },
          // },
          // entregasRecibidas: true,
          // notificacionesUsuarios: {
          //   include: {
          //     notificacion: true, // Incluye los detalles de la notificación en la tabla intermedia
          //   },
          // },
          // solicitudesAprobadas: true,
          // solicitudesPrecio: true,
          // TransferenciaProducto: true,
        },
      });
      return users;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Error al encontrar usuarios');
    }
  }

  async getUsersToSelect() {
    try {
      const users = await this.prisma.usuario.findMany({
        select: {
          id: true,
          nombre: true,
          rol: true,
        },
      });

      return users.map((u) => ({
        id: u.id,
        nombre: u.nombre,
        rol: u.rol,
      }));
    } catch (error) {
      console.log('El error es: ', error);
    }
  }

  //ENCONTRAR SIMPLE USER
  async findOne(id: number) {
    try {
      const user = await this.prisma.usuario.findUnique({
        where: { id },
      });
      return user;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Error al encontrar usuarios');
    }
  }

  async updateUserAsAdmin(
    adminId: number,
    adminUpdateUserDto: AdminUpdateUserDto,
  ) {
    try {
      const { userId, nuevaContrasena, adminPassword, ...dataToUpdate } =
        adminUpdateUserDto;

      // Verificar contraseña del administrador
      const admin = await this.prisma.usuario.findUnique({
        where: { id: adminId },
        select: { contrasena: true },
      });

      if (!admin || !(await bcrypt.compare(adminPassword, admin.contrasena))) {
        throw new BadRequestException(
          'La contraseña del administrador no es válida',
        );
      }

      // Si hay una nueva contraseña, generar el hash
      let hashedPassword = null;
      if (nuevaContrasena) {
        const salt = await bcrypt.genSalt(10);
        hashedPassword = await bcrypt.hash(nuevaContrasena, salt);
      }

      // Preparar los datos para actualizar
      const updateData = {
        ...dataToUpdate,
        ...(hashedPassword && { contrasena: hashedPassword }),
      };

      // Actualizar el usuario
      const updatedUser = await this.prisma.usuario.update({
        where: { id: userId },
        data: updateData,
      });

      return updatedUser;
    } catch (error) {
      console.error('Error al actualizar el usuario:', error);
      throw new BadRequestException('Error al actualizar el usuario');
    }
  }

  async updateMyUser(idUser: number, updateUserDto: UpdateUserDto) {
    try {
      const { contrasena, contrasenaConfirm, ...data } = updateUserDto;

      console.log('Los datos son: ', contrasena, contrasenaConfirm, data);

      let contrasenaHash;

      if (contrasena && contrasenaConfirm) {
        const currentUser = await this.prisma.usuario.findUnique({
          where: { id: idUser },
          select: { contrasena: true }, // Solo traemos el hash de la contraseña
        });

        if (!currentUser) {
          throw new BadRequestException('Usuario no encontrado');
        }

        const isMatch = await bcrypt.compare(
          contrasenaConfirm,
          currentUser.contrasena,
        );
        if (!isMatch) {
          throw new BadRequestException('La contraseña actual no es correcta');
        }

        const salt = await bcrypt.genSalt(10);
        contrasenaHash = await bcrypt.hash(contrasena, salt);
      }

      const dataToUpdate = {
        ...data,
        ...(contrasenaHash && { contrasena: contrasenaHash }), // Solo agrega la contraseña si fue actualizada
      };

      const userToUpdate = await this.prisma.usuario.update({
        where: { id: idUser },
        data: dataToUpdate,
      });

      console.log('El usuario actualizado es: ', userToUpdate);

      return userToUpdate;
    } catch (error) {
      console.error('Error al actualizar el usuario:', error);
      throw new BadRequestException('Error al actualizar el usuario');
    }
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    try {
      const userToUpdate = await this.prisma.usuario.update({
        where: { id },
        data: updateUserDto,
      });
      return userToUpdate;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Error al actualizar usuario');
    }
  }

  async remove(id: number) {
    try {
      const userToDelete = await this.prisma.usuario.delete({
        where: { id },
      });
      return userToDelete;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Error al actualizar usuario');
    }
  }

  async removeAllUsers() {
    try {
      const usersToDelete = await this.prisma.usuario.deleteMany({});
      return usersToDelete;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Error al eliminar usuarios');
    }
  }

  async findMyUser(id: number) {
    try {
      const myUser = await this.prisma.usuario.findUnique({
        where: {
          id,
        },
        select: {
          id: true,
          nombre: true,
          activo: true,
          correo: true,
          rol: true,
        },
      });

      return myUser;
    } catch (error) {
      console.log(error);
      throw new BadRequestException('Error al conseguir usuario');
    }
  }

  async findAllUsersWithSales() {
    try {
      const usersWithSales = await this.prisma.usuario.findMany({
        orderBy: {
          fecha_actualizacion: 'asc',
        },
        include: {
          sucursal: {
            select: {
              id: true,
              nombre: true,
            },
          },
          ventas: {
            select: {
              id: true,
            },
          },
        },
      });

      // Procesar para obtener el total de ventas por usuario
      const result = usersWithSales.map((user) => ({
        id: user.id,
        nombre: user.nombre,
        correo: user.correo,
        sucursal: user.sucursal,
        rol: user.rol,
        activo: user.activo,
        totalVentas: user.ventas.length,
      }));

      return result;
    } catch (error) {
      console.error('Error al obtener los usuarios con ventas:', error);
      throw new Error('No se pudieron cargar los datos.');
    }
  }
}
