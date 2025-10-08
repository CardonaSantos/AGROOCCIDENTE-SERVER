import { PartialType } from '@nestjs/mapped-types';
import { CreateStockThresholdPresentacionDto } from './create-stock-threshold-presentacion.dto';

export class UpdateStockThresholdPresentacionDto extends PartialType(CreateStockThresholdPresentacionDto) {}
