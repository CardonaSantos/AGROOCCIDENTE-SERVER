// main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: [
      'https://sabisu-server.up.railway.app',
      'http://127.0.0.1:5173',
      // agrega aquí cualquier otro origin de tu front (p.ej. http://localhost:3001)
    ],
    credentials: true, // <- para cookies/withCredentials
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    // exposedHeaders: ['set-cookie'], // opcional
  });

  await app.listen(process.env.PORT || 3000);
}
bootstrap();
