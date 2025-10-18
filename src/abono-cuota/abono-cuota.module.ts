import { Module } from '@nestjs/common';
import { AbonoCuotaService } from './abono-cuota.service';
import { AbonoCuotaController } from './abono-cuota.controller';

@Module({
  controllers: [AbonoCuotaController],
  providers: [AbonoCuotaService],
})
export class AbonoCuotaModule {}
