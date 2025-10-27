import { Module } from '@nestjs/common';
import { TipoPresentacionService } from './tipo-presentacion.service';
import { TipoPresentacionController } from './tipo-presentacion.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TipoPresentacionController],
  providers: [TipoPresentacionService],
})
export class TipoPresentacionModule {}
