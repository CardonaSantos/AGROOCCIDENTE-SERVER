import { PartialType } from '@nestjs/mapped-types';
import { CreateCreditoAutorizationDto } from './create-credito-autorization.dto';

export class UpdateCreditoAutorizationDto extends PartialType(CreateCreditoAutorizationDto) {}
