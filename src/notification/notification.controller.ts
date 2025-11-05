import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { DeleteOneUserNoti } from './dto/queryDelete';
import { DeleteNotiDto } from './dto/DeleteNotiDto';
// import { TipoNotificacion } from '@prisma/client';

@Controller('notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get('/get-my-notifications/:id')
  getMyNotifications(@Param('id', ParseIntPipe) id: number) {
    return this.notificationService.getMyNotifications(id);
  }

  @Post('delete-noti-one-user')
  async removeOneForUser(@Body() dto: DeleteNotiDto): Promise<void> {
    await this.notificationService.deleteForUser(
      dto.userID,
      dto.notificacionId,
    );
  }
  // delete-my-notification
}
