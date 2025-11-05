import { PartialType } from '@nestjs/mapped-types';
import { CreateProrrateoDto } from './create-prorrateo.dto';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { EstadoProrrateo } from '@prisma/client';

export class UpdateProrrateoDto extends PartialType(CreateProrrateoDto) {
  @IsOptional()
  @IsEnum(EstadoProrrateo)
  estado?: EstadoProrrateo;

  @IsOptional()
  @IsString()
  comentario?: string;
}
