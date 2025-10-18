import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { CreditoAutorizationService } from './credito-autorization.service';
import { CreateCreditoAutorizationDto } from './dto/create-credito-autorization.dto';
import { UpdateCreditoAutorizationDto } from './dto/update-credito-autorization.dto';

@Controller('credito-authorization')
export class CreditoAutorizationController {
  constructor(
    private readonly creditoAutorizationService: CreditoAutorizationService,
  ) {}

  @Post('create-authorization')
  create(@Body() createCreditoAutorizationDto: CreateCreditoAutorizationDto) {
    return this.creditoAutorizationService.create(createCreditoAutorizationDto);
  }

  @Get('get-authorization-records')
  getAuthorizationsRecords() {
    return this.creditoAutorizationService.getAutorizaciones();
  }
}
