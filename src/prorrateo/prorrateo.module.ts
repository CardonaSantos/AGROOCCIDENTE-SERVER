import { Module } from '@nestjs/common';
import { ProrrateoService } from './prorrateo.service';
import { ProrrateoController } from './prorrateo.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ProrrateoController],
  providers: [ProrrateoService],
})
export class ProrrateoModule {}
