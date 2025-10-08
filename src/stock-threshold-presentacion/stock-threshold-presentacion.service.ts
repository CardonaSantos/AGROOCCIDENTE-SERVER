import { Injectable } from '@nestjs/common';
import { CreateStockThresholdPresentacionDto } from './dto/create-stock-threshold-presentacion.dto';
import { UpdateStockThresholdPresentacionDto } from './dto/update-stock-threshold-presentacion.dto';

@Injectable()
export class StockThresholdPresentacionService {
  create(createStockThresholdPresentacionDto: CreateStockThresholdPresentacionDto) {
    return 'This action adds a new stockThresholdPresentacion';
  }

  findAll() {
    return `This action returns all stockThresholdPresentacion`;
  }

  findOne(id: number) {
    return `This action returns a #${id} stockThresholdPresentacion`;
  }

  update(id: number, updateStockThresholdPresentacionDto: UpdateStockThresholdPresentacionDto) {
    return `This action updates a #${id} stockThresholdPresentacion`;
  }

  remove(id: number) {
    return `This action removes a #${id} stockThresholdPresentacion`;
  }
}
