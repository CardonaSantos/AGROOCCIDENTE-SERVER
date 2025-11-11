import { Module } from '@nestjs/common';
import { PayloadProductosModuleService } from './payload-productos-module.service';
import { PayloadProductosModuleController } from './payload-productos-module.controller';

@Module({
  controllers: [PayloadProductosModuleController],
  providers: [PayloadProductosModuleService],
})
export class PayloadProductosModuleModule {}
