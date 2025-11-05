import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { IsInt } from 'class-validator';

export class DeleteNotiDto {
  @IsInt()
  userID: number;

  @IsInt()
  notificacionId: number;
}
