import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { CreditoService } from './credito.service';
import { CreateCreditoDto } from './dto/create-credito.dto';
import { UpdateCreditoDto } from './dto/update-credito.dto';
import { CreditoQuery } from './query/query';

@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
  }),
)
@Controller('credito')
export class CreditoController {
  constructor(private readonly creditoService: CreditoService) {}

  @Post()
  create(@Body() createCreditoDto: CreateCreditoDto) {
    return this.creditoService.create(createCreditoDto);
  }

  @Get() // <-- agrega esto
  findAll(@Query() query: CreditoQuery) {
    return this.creditoService.findAll(query);
  }
}
