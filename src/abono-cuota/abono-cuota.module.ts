import { Module } from '@nestjs/common';
import { AbonoCuotaService } from './abono-cuota.service';
import { AbonoCuotaController } from './abono-cuota.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AbonoCuotaController],
  providers: [AbonoCuotaService],
})
export class AbonoCuotaModule {}
