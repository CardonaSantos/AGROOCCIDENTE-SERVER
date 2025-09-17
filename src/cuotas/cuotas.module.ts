import { Module } from '@nestjs/common';
import { CuotasService } from './cuotas.service';
import { CuotasController } from './cuotas.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { CajaModule } from 'src/caja/caja.module';

@Module({
  imports: [CajaModule],
  controllers: [CuotasController],
  providers: [CuotasService, PrismaService],
})
export class CuotasModule {}
