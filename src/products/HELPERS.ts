import { Prisma } from '@prisma/client';

const INS = 'insensitive' as const; // <- literal type (QueryMode)

// ---------------------------------------------
// Producto
// ---------------------------------------------
export function buildSearchForProducto(
  q: string,
): Prisma.ProductoWhereInput | undefined {
  const tokens = (q || '').trim().split(/\s+/).filter(Boolean).slice(0, 5);
  if (!tokens.length) return undefined;

  // Cada item del AND es un ProductoWhereInput
  const ands: Prisma.ProductoWhereInput[] = tokens.map((t) => ({
    OR: [
      { nombre: { contains: t, mode: INS } },
      { codigoProducto: { contains: t, mode: INS } },
      { codigoProveedor: { contains: t, mode: INS } },
    ],
  }));

  const where: Prisma.ProductoWhereInput = { AND: ands };

  // Heurística para SKUs/códigos
  const s = (q || '').trim();
  const looksLikeCode = /^\d{6,}$/.test(s) || /^[A-Z0-9\-]{6,}$/i.test(s);

  if (looksLikeCode) {
    const extraOr: Prisma.ProductoWhereInput[] = [
      // equals aquí puede ir sin mode; startsWith/contains sí usan mode
      { codigoProducto: { equals: q } },
      { codigoProducto: { startsWith: q, mode: INS } },
      { codigoProveedor: { equals: q } },
      { codigoProveedor: { startsWith: q, mode: INS } },
    ];
    where.OR = [...(where.OR ?? []), ...extraOr];
  }

  return where;
}

// ---------------------------------------------
// Presentación
// ---------------------------------------------
export function buildSearchForPresentacion(
  q: string,
): Prisma.ProductoPresentacionWhereInput | undefined {
  const tokens = (q || '').trim().split(/\s+/).filter(Boolean).slice(0, 5);
  if (!tokens.length) return undefined;

  const ands: Prisma.ProductoPresentacionWhereInput[] = tokens.map((t) => ({
    OR: [
      { nombre: { contains: t, mode: INS } },
      { codigoBarras: { contains: t, mode: INS } },
      {
        producto: {
          is: {
            OR: [
              { nombre: { contains: t, mode: INS } },
              { codigoProducto: { contains: t, mode: INS } },
              { codigoProveedor: { contains: t, mode: INS } },
            ],
          },
        },
      },
    ],
  }));

  const where: Prisma.ProductoPresentacionWhereInput = { AND: ands };

  const s = (q || '').trim();
  const looksLikeCode = /^\d{6,}$/.test(s) || /^[A-Z0-9\-]{6,}$/i.test(s);
  if (looksLikeCode) {
    const extraOr: Prisma.ProductoPresentacionWhereInput[] = [
      { codigoBarras: { equals: q } },
      { codigoBarras: { startsWith: q, mode: INS } },
      {
        producto: {
          is: {
            OR: [
              { codigoProducto: { equals: q } },
              { codigoProducto: { startsWith: q, mode: INS } },
              { codigoProveedor: { equals: q } },
              { codigoProveedor: { startsWith: q, mode: INS } },
            ],
          },
        },
      },
    ];
    where.OR = [...(where.OR ?? []), ...extraOr];
  }

  return where;
}
