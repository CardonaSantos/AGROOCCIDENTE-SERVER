import { Injectable } from '@nestjs/common';
import { CreateAbonoCuotaDto } from './dto/create-abono-cuota.dto';
import { UpdateAbonoCuotaDto } from './dto/update-abono-cuota.dto';

@Injectable()
export class AbonoCuotaService {
  create(createAbonoCuotaDto: CreateAbonoCuotaDto) {
    return 'This action adds a new abonoCuota';
  }

  findAll() {
    return `This action returns all abonoCuota`;
  }

  findOne(id: number) {
    return `This action returns a #${id} abonoCuota`;
  }

  update(id: number, updateAbonoCuotaDto: UpdateAbonoCuotaDto) {
    return `This action updates a #${id} abonoCuota`;
  }

  remove(id: number) {
    return `This action removes a #${id} abonoCuota`;
  }
}
