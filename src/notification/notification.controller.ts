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
// import { TipoNotificacion } from '@prisma/client';

@Controller('notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get('/get-my-notifications/:id')
  getMyNotifications(@Param('id', ParseIntPipe) id: number) {
    return this.notificationService.getMyNotifications(id);
  }

  @Delete('/delete-noti-one-user/:userId/:notificacionId')
  deleteOneUserNotification(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('notificacionId', ParseIntPipe) notificacionId: number,
  ) {
    return this.notificationService.deleteForUser(userId, notificacionId);
  }

  // delete-my-notification
}
