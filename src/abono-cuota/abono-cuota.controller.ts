import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AbonoCuotaService } from './abono-cuota.service';
import { CreateAbonoCuotaDto } from './dto/create-abono-cuota.dto';
import { UpdateAbonoCuotaDto } from './dto/update-abono-cuota.dto';
import { DeleteAbonoCuotaDto } from './dto/delete-cuota';

@Controller('abono-cuota')
export class AbonoCuotaController {
  constructor(private readonly abonoCuotaService: AbonoCuotaService) {}

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  create(@Body() dto: CreateAbonoCuotaDto) {
    return this.abonoCuotaService.create(dto);
  }
  @Get()
  findAll() {}

  @Get(':id')
  findOne(@Param('id') id: string) {}

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateAbonoCuotaDto: UpdateAbonoCuotaDto,
  ) {}

  @Post('delete')
  removePost(@Body() dto: DeleteAbonoCuotaDto) {
    return this.abonoCuotaService.delete(dto);
  }
}
