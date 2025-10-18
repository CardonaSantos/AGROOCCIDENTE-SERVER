import { PartialType } from '@nestjs/mapped-types';
import { CreateAbonoCuotaDto } from './create-abono-cuota.dto';

export class UpdateAbonoCuotaDto extends PartialType(CreateAbonoCuotaDto) {}
