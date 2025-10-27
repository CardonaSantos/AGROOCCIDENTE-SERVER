import { Prisma } from '@prisma/client';

const INS = 'insensitive' as const; // <- literal type (QueryMode)

// ---------------------------------------------
// Producto
// ---------------------------------------------
export function buildSearchForProducto(
  q: string,
): Prisma.ProductoWhereInput | undefined {
  const raw = (q || '').trim();
  const tokens = tokenize(raw);
  if (!tokens.length) return undefined;

  const looksLikeCode = /^[A-Z0-9\-]{6,}$/i.test(raw) || /^\d{6,}$/.test(raw);

  // Cada token exige uno de estos OR (AND entre tokens)
  const ands: Prisma.ProductoWhereInput[] = tokens.map((t) => {
    const orList: Prisma.ProductoWhereInput[] = [
      { nombre: { contains: t, mode: INS } },
      { codigoProducto: { contains: t, mode: INS } },
      { codigoProveedor: { contains: t, mode: INS } },
      // match cruzado: si escriben el barcode de una presentación, que aparezca el producto
      {
        presentaciones: { some: { codigoBarras: { contains: t, mode: INS } } },
      },
    ];

    // Si el token o el query completo parece SKU, agrega equals/startsWith
    if (looksLikeCode) {
      orList.push(
        { codigoProducto: { equals: raw } },
        { codigoProducto: { startsWith: raw, mode: INS } },
        { codigoProveedor: { equals: raw } },
        { codigoProveedor: { startsWith: raw, mode: INS } },
        { presentaciones: { some: { codigoBarras: { equals: raw } } } },
        {
          presentaciones: {
            some: { codigoBarras: { startsWith: raw, mode: INS } },
          },
        },
      );
    }

    return { OR: orList };
  });

  return { AND: ands };
}
const tokenize = (q?: string) =>
  (q ?? '')
    .trim()
    .split(/[\s\-_.]+/) // ← separa por espacio, guión, underscore y punto
    .filter(Boolean)
    .slice(0, 5);
export function buildSearchForPresentacion(
  q: string,
): Prisma.ProductoPresentacionWhereInput | undefined {
  const raw = (q || '').trim();
  const tokens = tokenize(raw);
  if (!tokens.length) return undefined;

  const looksLikeCode = /^[A-Z0-9\-]{6,}$/i.test(raw) || /^\d{6,}$/.test(raw);

  const ands: Prisma.ProductoPresentacionWhereInput[] = tokens.map((t) => {
    const orList: Prisma.ProductoPresentacionWhereInput[] = [
      { nombre: { contains: t, mode: INS } },
      { codigoBarras: { contains: t, mode: INS } },
      // match cruzado hacia el producto
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
    ];

    if (looksLikeCode) {
      orList.push(
        { codigoBarras: { equals: raw } },
        { codigoBarras: { startsWith: raw, mode: INS } },
        {
          producto: {
            is: {
              OR: [
                { codigoProducto: { equals: raw } },
                { codigoProducto: { startsWith: raw, mode: INS } },
                { codigoProveedor: { equals: raw } },
                { codigoProveedor: { startsWith: raw, mode: INS } },
              ],
            },
          },
        },
      );
    }

    return { OR: orList };
  });

  return { AND: ands };
}
