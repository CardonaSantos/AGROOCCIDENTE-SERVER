import { Module } from '@nestjs/common';
import { CreditoAutorizationService } from './credito-autorization.service';
import { CreditoAutorizationController } from './credito-autorization.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [CreditoAutorizationController],
  providers: [CreditoAutorizationService, PrismaService],
})
export class CreditoAutorizationModule {}
