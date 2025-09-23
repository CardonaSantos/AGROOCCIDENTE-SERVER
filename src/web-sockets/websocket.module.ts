import { Module, forwardRef } from '@nestjs/common';
import { LegacyGateway } from './websocket.gateway';

@Module({
  providers: [LegacyGateway],
  exports: [LegacyGateway],
})
export class GatewayModule {}
