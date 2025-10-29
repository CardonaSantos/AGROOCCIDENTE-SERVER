import { IsInt } from 'class-validator';

export class DeleteOneUserNoti {
  @IsInt()
  userId: number;
  @IsInt()
  notificationId: number;
}
