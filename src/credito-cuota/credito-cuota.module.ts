import { Module } from '@nestjs/common';
import { CreditoCuotaService } from './credito-cuota.service';
import { CreditoCuotaController } from './credito-cuota.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CreditoCuotaController],
  providers: [CreditoCuotaService],
})
export class CreditoCuotaModule {}
