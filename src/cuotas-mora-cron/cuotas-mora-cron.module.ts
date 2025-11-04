import { Module } from '@nestjs/common';
import { CuotasMoraCronService } from './cuotas-mora-cron.service';
import { CuotasMoraCronController } from './cuotas-mora-cron.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { NotificationModule } from 'src/notification/notification.module';

@Module({
  imports: [PrismaModule, NotificationModule],
  controllers: [CuotasMoraCronController],
  providers: [CuotasMoraCronService],
})
export class CuotasMoraCronModule {}
