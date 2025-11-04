import { BadRequestException } from '@nestjs/common';

// Normaliza a NULL si viene vacío o solo espacios
export function nullIfEmpty(v?: string | null): string | null {
  if (v == null) return null;
  const t = String(v).trim();
  return t === '' ? null : t;
}

// DPI: solo dígitos
export function normalizeDpi(v?: string | null): string | null {
  const n = nullIfEmpty(v);
  if (n == null) return null;
  const digits = n.replace(/\D/g, '');
  return digits || null;
}
export function isValidDpi(dpi: string): boolean {
  return /^\d{13}$/.test(dpi); // 13 dígitos exactos
}

// NIT GT: dígitos + posible 'K' final; guiones/espacios permitidos al ingresar
export function normalizeNit(v?: string | null): string | null {
  const n = nullIfEmpty(v);
  if (n == null) return null;
  const cleaned = n.toUpperCase().replace(/[^0-9K]/g, '');
  return cleaned || null;
}
export function isValidNit(nit: string): boolean {
  // 7–12 dígitos + dígito verificador (0–9 o K)
  return /^[0-9]{7,12}[0-9K]$/.test(nit);
}

// Regla: debe venir al menos uno
export function ensureOneDoc(dpi: string | null, nit: string | null) {
  if (!dpi && !nit) {
    throw new BadRequestException('Debe proporcionar DPI o NIT.');
  }
}
