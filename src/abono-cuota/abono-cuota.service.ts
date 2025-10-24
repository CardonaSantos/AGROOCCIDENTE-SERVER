import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { CreateAbonoCuotaDto } from './dto/create-abono-cuota.dto';
import { UpdateAbonoCuotaDto } from './dto/update-abono-cuota.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AbonoCuotaService {
  private readonly logger = new Logger(AbonoCuotaService.name);
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateAbonoCuotaDto) {
    this.logger.log(
      `DTO recibido en abono cuota:\n${JSON.stringify(dto, null, 2)}`,
    );

    try {
      // const cuotaId = await this.prisma.abon
    } catch (error) {
      this.logger.error('Error en módulo abono cuotas: ', error?.stack);
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'Fatal error: Error inesperado en módulo abonos',
      );
    }
  }
}
