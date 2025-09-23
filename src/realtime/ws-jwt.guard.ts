// realtime/ws-jwt.guard.ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
// shared/jwt-payload.ts
export interface JwtPayload {
  sub: number; // userId
  rol: 'ADMIN' | 'VENDEDOR' | string;
  sucursalId?: number;
  nombre?: string;
  correo?: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const client: Socket = ctx.switchToWs().getClient<Socket>();

    // 1) Intenta leer el token del handshake
    const authHeader = client.handshake.headers?.authorization ?? '';
    const bearer = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : undefined;

    const token =
      client.handshake.auth?.token ||
      bearer ||
      (client.handshake.query?.token as string | undefined);

    if (!token) throw new WsException('Falta token');

    try {
      const payload = this.jwt.verify<JwtPayload>(token);
      client.data.user = {
        id: payload.sub,
        rol: payload.rol,
        sucursalId: payload.sucursalId,
        //
      };
      return true;
    } catch {
      throw new WsException('Token inválido o expirado');
    }
  }
}
