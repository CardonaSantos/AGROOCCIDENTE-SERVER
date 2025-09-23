// realtime/realtime.gateway.ts
import { Logger, UseGuards } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { RealtimeEmitter } from './realtimeEmitter';
import { WsJwtGuard } from './ws-jwt.guard';

type UserOnSocket = { id: number; rol: string; sucursalId?: number };

@WebSocketGateway({ namespace: '/ws', cors: { origin: '*' } })
@UseGuards(WsJwtGuard) // sigue protegiendo los @SubscribeMessage; el middleware protege la conexión
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);
  @WebSocketServer() io: Server;
  constructor(
    private readonly rt: RealtimeEmitter,
    private readonly jwt: JwtService, // asegúrate de importar AuthModule/JwtModule en RealtimeModule
  ) {}

  afterInit(io: Server) {
    this.rt.attach(io);

    // 🔐 Middleware de autenticación del handshake
    io.use((socket, next) => {
      const authHeader = socket.handshake.headers?.authorization ?? '';
      const bearer = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : undefined;
      const token =
        socket.handshake.auth?.token ||
        bearer ||
        (socket.handshake.query?.token as string | undefined);

      if (!token) return next(new Error('Falta token'));
      try {
        const payload = this.jwt.verify<any>(token);
        socket.data.user = {
          id: Number(payload.sub ?? payload.id),
          rol: payload.rol,
          sucursalId: payload.sucursalId
            ? Number(payload.sucursalId)
            : undefined,
        } as UserOnSocket;
        next();
      } catch {
        next(new Error('Token inválido o expirado'));
      }
    });
  }

  handleConnection(socket: Socket) {
    // 🚧 Null-check defensivo para evitar crashes
    const user = socket.data?.user as UserOnSocket | undefined;
    if (!user?.id || !user.rol) {
      socket.emit('error', { message: 'Unauthorized' });
      socket.disconnect(true);
      return;
    }

    socket.join(`user:${user.id}`);
    socket.join(`role:${user.rol}`);
    if (user.sucursalId) socket.join(`sucursal:${user.sucursalId}`);

    console.log(`[WS] connected user=${user.id} rol=${user.rol}`);
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() socket: Socket) {
    socket.emit('pong', { ts: Date.now() });
  }

  @SubscribeMessage('whoami')
  handleWhoAmI(@ConnectedSocket() socket: Socket) {
    socket.emit('whoami', socket.data.user);
  }

  //TEST
  @SubscribeMessage('solicitud:precio.request')
  async handleSolicitarPrecio(
    @MessageBody() body: { productoID: number; nuevoPrecio: number },
    @ConnectedSocket() socket: Socket,
  ) {
    //aqui validaria y persistiría en la DB el registro
    const solicitudID = body.productoID;
    this.logger.log('La data llegando por socket es: ', JSON.stringify(body));
    //opcional notificar a roles o usuarios definir manualmente
    // socket.nsp
    //   .to('role:ADMIN')
    //   .emit('credit:request.created', { id: solicitudID });

    //helper definido en ts
    this.rt.toRole('ADMIN', 'credit:request.created', {
      id: solicitudID,
      nuevoPrecio: body.nuevoPrecio * 2,
    }); // 👈 SERVER EMITE

    return {
      ok: true,
      solicitudID,
    };
  }
}
