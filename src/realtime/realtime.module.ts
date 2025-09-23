// realtime/realtime.module.ts
import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtModule } from '@nestjs/jwt';
// import { AuthModule } from '../auth/auth.module'; // alternativa si ahí exportas JwtModule
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeEmitter } from './realtimeEmitter';
import { WsJwtGuard } from './ws-jwt.guard';
import { VentasEventsListener } from './listeners/ventas.events.listener';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    AuthModule, // usar el mismo auth que hay en login para no firmar erroneamente
  ],
  providers: [
    RealtimeGateway,
    RealtimeEmitter,
    WsJwtGuard,
    VentasEventsListener,
  ],
  exports: [RealtimeEmitter],
})
export class RealtimeModule {}
