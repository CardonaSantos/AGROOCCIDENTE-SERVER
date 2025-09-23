// realtime/listeners/ventas.events.listener.ts
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { RealtimeEmitter } from '../realtimeEmitter';

type VentaCreatedPayload = {
  id: number;
  sucursalId: number;
  total: number;
};

@Injectable()
export class VentasEventsListener {
  constructor(private readonly rt: RealtimeEmitter) {}

  // Escucha eventos de dominio y los traduce a WS
  @OnEvent('venta.created') // 👈 nombre del evento interno
  handleVentaCreated(payload: VentaCreatedPayload) {
    // Notifica a todos los clientes suscritos a la sucursal
    this.rt.toSucursal(payload.sucursalId, 'ventas:created', payload);

    // O dispara una invalidación genérica para TanStack Query
    this.rt.toSucursal(payload.sucursalId, 'ventas:invalidate', {
      reason: 'created',
    });
  }

  @OnEvent('venta.updated')
  handleVentaUpdated(payload: VentaCreatedPayload) {
    this.rt.toSucursal(payload.sucursalId, 'ventas:invalidate', {
      reason: 'updated',
    });
  }
}
