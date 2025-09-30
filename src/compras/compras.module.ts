import { Module } from '@nestjs/common';
import { ComprasService } from './compras.service';
import { ComprasController } from './compras.controller';
import { RecepcionesModule } from './recepciones/recepciones.module';
import { ComprasPagosModule } from './cxp/compras-pagos/compras-pagos.module';
import { DocumentoModule } from './cxp/documento/documento.module';
import { PrismaService } from 'src/prisma/prisma.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  controllers: [ComprasController],
  providers: [ComprasService],
  imports: [
    RecepcionesModule,
    ComprasPagosModule,
    DocumentoModule,
    PrismaModule,
  ],
})
export class ComprasModule {}
