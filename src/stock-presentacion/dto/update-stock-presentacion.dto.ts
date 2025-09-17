import { PartialType } from '@nestjs/mapped-types';
import { CreateStockPresentacionDto } from './create-stock-presentacion.dto';

export class UpdateStockPresentacionDto extends PartialType(CreateStockPresentacionDto) {}
