// unidad-conversion.service.ts
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Injectable()
export class UnidadConversionService {
  toBaseUnits(cantPresentacion: number, factor: Prisma.Decimal | number) {
    const f =
      factor instanceof Prisma.Decimal ? factor : new Prisma.Decimal(factor);
    return new Prisma.Decimal(cantPresentacion).mul(f); // Decimal
  }
}
