import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { CuotasMoraCronService } from './cuotas-mora-cron.service';
import { CreateCuotasMoraCronDto } from './dto/create-cuotas-mora-cron.dto';
import { UpdateCuotasMoraCronDto } from './dto/update-cuotas-mora-cron.dto';

@Controller('cuotas-mora-cron')
export class CuotasMoraCronController {
  constructor(private readonly cuotasMoraCronService: CuotasMoraCronService) {}

  @Post()
  create(@Body() createCuotasMoraCronDto: CreateCuotasMoraCronDto) {}
}
