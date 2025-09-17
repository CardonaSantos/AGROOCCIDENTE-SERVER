import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { CreateStockPresentacionDto } from './dto/create-stock-presentacion.dto';
import { UpdateStockPresentacionDto } from './dto/update-stock-presentacion.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class StockPresentacionService {
  private readonly logger = new Logger(StockPresentacionService.name);
  constructor(private readonly prisma: PrismaService) {}

  create(createStockPresentacionDto: CreateStockPresentacionDto) {
    return 'This action adds a new stockPresentacion';
  }

  findAll() {
    return `This action returns all stockPresentacion`;
  }

  findOne(id: number) {
    return `This action returns a #${id} stockPresentacion`;
  }

  update(id: number, updateStockPresentacionDto: UpdateStockPresentacionDto) {
    return `This action updates a #${id} stockPresentacion`;
  }

  remove(id: number) {
    return `This action removes a #${id} stockPresentacion`;
  }

  async removeAll() {
    try {
      const stocksToDelete = await this.prisma.stockPresentacion.deleteMany({});
      this.logger.log('Eliminados: ', stocksToDelete.count);
      return stocksToDelete;
    } catch (error) {
      this.logger.error('Error generado en eliminar stock-presentaciones');
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Fatal error: Error inesperado');
    }
  }
}
