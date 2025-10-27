import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { PrismaService } from 'src/prisma/prisma.service';

type cloudinaryUploadResult = { url: string; public_id: string };

@Injectable()
export class CloudinaryService {
  constructor(private readonly prisma: PrismaService) {}

  async subirImagenFile(
    file: Express.Multer.File,
  ): Promise<cloudinaryUploadResult> {
    if (!file.mimetype.startsWith('image/')) {
      throw new Error(`Tipo no permitido: ${file.mimetype}`);
    }

    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'AGROSERVICIO-PRODUCTOS',
          resource_type: 'image',
        },
        (error, result) => {
          if (error) return reject(error);
          if (!result?.secure_url || !result?.public_id) {
            return reject(new Error('Cloudinary no devolvió datos válidos'));
          }
          resolve({ url: result.secure_url, public_id: result.public_id });
        },
      );
      stream.end(file.buffer); //subir buffer directamente
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
