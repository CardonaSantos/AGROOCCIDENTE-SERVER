import { PartialType } from '@nestjs/mapped-types';
import { CreateCuotasMoraCronDto } from './create-cuotas-mora-cron.dto';

export class UpdateCuotasMoraCronDto extends PartialType(CreateCuotasMoraCronDto) {}
