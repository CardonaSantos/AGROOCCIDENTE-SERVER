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
import { CreditoAutorizationService } from './credito-autorization.service';
import { CreateCreditoAutorizationDto } from './dto/create-credito-autorization.dto';
import { GetCreditoAutorizacionesDto } from './dto/get-credito-autorizaciones.dto';
import { AcceptCreditoDTO } from './dto/acept-credito-auth';
import { RejectCreditoAuth } from './dto/reject-credito';

@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
  }),
)
@Controller('credito-authorization')
export class CreditoAutorizationController {
  constructor(
    private readonly creditoAutorizationService: CreditoAutorizationService,
  ) {}

  /**
   * Metodo para crear una autorización
   * @param createCreditoAutorizationDto info para crear una auth.Credito (persistencia de datos)
   * @returns envía por ws notifiacion y crea la persistencia
   */
  @Post('create-authorization')
  createAuth(
    @Body() createCreditoAutorizationDto: CreateCreditoAutorizationDto,
  ) {
    return this.creditoAutorizationService.create(createCreditoAutorizationDto);
  }

  @Post('create-credito-from-auth')
  aceptAuthCredit(@Body() dto: AcceptCreditoDTO) {
    return this.creditoAutorizationService.createCredito(dto);
  }

  @Patch('reject-credito-from-auth')
  rejectAuthCredit(@Body() dto: RejectCreditoAuth) {
    return this.creditoAutorizationService.rejectCredito(dto);
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
