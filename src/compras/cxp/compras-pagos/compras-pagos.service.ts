import { Injectable } from '@nestjs/common';
import { CreateComprasPagoDto } from './dto/create-compras-pago.dto';
import { UpdateComprasPagoDto } from './dto/update-compras-pago.dto';

@Injectable()
export class ComprasPagosService {
  create(createComprasPagoDto: CreateComprasPagoDto) {
    return 'This action adds a new comprasPago';
  }

  findAll() {
    return `This action returns all comprasPagos`;
  }

  findOne(id: number) {
    return `This action returns a #${id} comprasPago`;
  }

  update(id: number, updateComprasPagoDto: UpdateComprasPagoDto) {
    return `This action updates a #${id} comprasPago`;
  }

  remove(id: number) {
    return `This action removes a #${id} comprasPago`;
  }
}
