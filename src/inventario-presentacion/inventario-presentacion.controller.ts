import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { InventarioPresentacionService } from './inventario-presentacion.service';
import { CreateInventarioPresentacionDto } from './dto/create-inventario-presentacion.dto';
import { UpdateInventarioPresentacionDto } from './dto/update-inventario-presentacion.dto';

@Controller('inventario-presentacion')
export class InventarioPresentacionController {
  constructor(
    private readonly inventarioPresentacionService: InventarioPresentacionService,
  ) {}
}
