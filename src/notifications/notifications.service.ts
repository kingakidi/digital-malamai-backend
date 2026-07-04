import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  NotificationChannel,
  NotificationStatus,
  NotificationType,
} from '../common/types/notification.types';
import { Notification } from './entities/notification.entity';

interface CreateNotificationInput {
  userId: string;
  channel: NotificationChannel;
  type: NotificationType;
  payload: Record<string, unknown>;
  status: NotificationStatus;
  sentAt?: Date | null;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationsRepository: Repository<Notification>,
  ) {}

  async log(input: CreateNotificationInput): Promise<Notification> {
    const notification = this.notificationsRepository.create({
      ...input,
      sentAt: input.sentAt ?? null,
    });

    return this.notificationsRepository.save(notification);
  }
}
