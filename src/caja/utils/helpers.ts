import { ComprobanteTipo, MetodoPago } from '@prisma/client';

// helpers (arriba del $transaction)
export const toComprobanteNumero = (s?: string) =>
  (s ?? '').replace(/\s+/g, ' ').trim().toUpperCase().slice(0, 64);

// Mapea ComprobanteTipo -> MetodoPago
export const metodoPagoFromComprobante = (t?: ComprobanteTipo): MetodoPago => {
  switch (t) {
    case 'DEPOSITO_BOLETA':
      return 'EFECTIVO';
    case 'TRANSFERENCIA':
      return 'TRANSFERENCIA';
    case 'CHEQUE':
      return 'CHEQUE';
    case 'TARJETA_VOUCHER':
      return 'TARJETA';
    case 'OTRO':
      return 'OTRO';
    default:
      return 'TRANSFERENCIA'; // fallback seguro
  }
};
