import { Injectable } from '@nestjs/common';
import { CreateCloudinaryDto } from './dto/create-cloudinary.dto';
import { UpdateCloudinaryDto } from './dto/update-cloudinary.dto';
import { v2 as cloudinary } from 'cloudinary';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class CloudinaryService {
  constructor(private readonly prisma: PrismaService) {}

  async subirImagen(
    image: string,
  ): Promise<{ url: string; public_id: string }> {
    return new Promise((resolve, reject) => {
      cloudinary.uploader.upload(
        image,
        { folder: 'AGROSERVICIO-PRODUCTOS' },
        (error, result) => {
          if (error) return reject(error);
          if (!result?.secure_url || !result?.public_id) {
            return reject(new Error('Cloudinary no devolvió datos válidos.'));
          }

          console.log('🖼️ Imagen subida a Cloudinary:', result);

          resolve({
            url: result.secure_url,
            public_id: result.public_id,
          });
        },
      );
    });
  }

  async reemplazarUnaImagen(image: string): Promise<string> {
    return new Promise((resolve, reject) => {
      cloudinary.uploader.upload(
        image,
        { folder: 'ProductosFotos' },
        (error, result) => {
          if (error) {
            return reject(error);
          }
          resolve(result.secure_url);
        },
      );
    });
  }

  async BorrarImagen(publicId: string): Promise<void> {
    console.log('El ID ES:', publicId);

    return new Promise((resolve, reject) => {
      cloudinary.uploader.destroy(publicId, (error, result) => {
        console.log('🧾 Resultado completo:', result);
        if (error) {
          console.log('🛑 Error Cloudinary:', error);
          return reject(error);
        }
        if (result.result !== 'ok') {
          console.log('⚠️ Resultado inesperado:', result.result);
          return reject(new Error(`Falló la eliminación: ${result.result}`));
        }
        resolve();
      });
    });
  }
}
