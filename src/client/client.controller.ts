import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
} from '@nestjs/common';
import { ClientService } from './client.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Controller('client')
export class ClientController {
  constructor(private readonly clientService: ClientService) {}

  @Post()
  create(@Body() createClientDto: CreateClientDto) {
    return this.clientService.create(createClientDto);
  }

  @Get('/get-all-customers')
  findAllCustomers() {
    return this.clientService.Customers();
  }

  @Get('/customers-to-warranty')
  findCustomersToWarranty() {
    return this.clientService.findCustomersToWarranty();
  }

  //Conseguir clientes para creditos
  @Get('/get-clients')
  getClientToCredit() {
    return this.clientService.getClientToCredit();
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateClientDto: UpdateClientDto,
  ) {
    return this.clientService.update(id, updateClientDto);
  }

  @Delete('/delete-all')
  removeAll() {
    return this.clientService.removeAll();
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.clientService.remove(+id);
  }
}
