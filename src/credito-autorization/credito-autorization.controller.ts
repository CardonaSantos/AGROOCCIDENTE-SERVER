import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { CreditoAutorizationService } from './credito-autorization.service';
import { CreateCreditoAutorizationDto } from './dto/create-credito-autorization.dto';
import { UpdateCreditoAutorizationDto } from './dto/update-credito-autorization.dto';
import { GetCreditoAutorizacionesDto } from './dto/get-credito-autorizaciones.dto';

@Controller('credito-authorization')
export class CreditoAutorizationController {
  constructor(
    private readonly creditoAutorizationService: CreditoAutorizationService,
  ) {}

  @Post('create-authorization')
  create(@Body() createCreditoAutorizationDto: CreateCreditoAutorizationDto) {
    return this.creditoAutorizationService.create(createCreditoAutorizationDto);
  }

  @Get()
  async list(@Query() query: GetCreditoAutorizacionesDto) {
    return this.creditoAutorizationService.getAutorizaciones(query);
  }

  @Delete('delete-all')
  async deleteAll() {
    return this.creditoAutorizationService.deleteAll();
  }
}
