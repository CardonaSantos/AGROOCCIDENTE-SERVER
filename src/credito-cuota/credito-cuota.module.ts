import { Module } from '@nestjs/common';
import { CreditoCuotaService } from './credito-cuota.service';
import { CreditoCuotaController } from './credito-cuota.controller';

@Module({
  controllers: [CreditoCuotaController],
  providers: [CreditoCuotaService],
})
export class CreditoCuotaModule {}
