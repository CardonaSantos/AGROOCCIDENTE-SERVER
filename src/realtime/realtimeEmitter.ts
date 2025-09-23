import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

// realtime/realtime.emitter.ts
@Injectable()
export class RealtimeEmitter {
  private io?: Server;
  attach(io: Server) {
    this.io = io;
  }
  toUser(id: number, evt: string, data: any) {
    this.io?.to(`user:${id}`).emit(evt, data);
  }
  toRole(rol: string, evt: string, data: any) {
    this.io?.to(`role:${rol}`).emit(evt, data);
  }
  toSucursal(id: number, evt: string, data: any) {
    this.io?.to(`sucursal:${id}`).emit(evt, data);
  }
  broadcast(evt: string, data: any) {
    this.io?.emit(evt, data);
  }
}
