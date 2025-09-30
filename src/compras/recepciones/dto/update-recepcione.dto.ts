import { PartialType } from '@nestjs/mapped-types';
import { CreateRecepcioneDto } from './create-recepcione.dto';

export class UpdateRecepcioneDto extends PartialType(CreateRecepcioneDto) {}
