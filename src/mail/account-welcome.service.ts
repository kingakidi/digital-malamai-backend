import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  NotificationChannel,
  NotificationStatus,
  NotificationType,
} from '../common/types/notification.types';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../user/entities/user.entity';
import { MailService } from './mail.service';

@Injectable()
export class AccountWelcomeService {
  private readonly logger = new Logger(AccountWelcomeService.name);

  constructor(
    private readonly mailService: MailService,
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService,
  ) {}

  dispatchPartnerWelcomeEmail(user: User, temporaryPassword: string): void {
    void this.sendWelcomeEmail(
      user,
      temporaryPassword,
      'partner-welcome',
      NotificationType.PARTNER_WELCOME,
      this.configService.get<string>('app.partnerPortalLoginUrl'),
    );
  }

  dispatchStaffWelcomeEmail(user: User, temporaryPassword: string): void {
    void this.sendWelcomeEmail(
      user,
      temporaryPassword,
      'staff-welcome',
      NotificationType.STAFF_WELCOME,
      this.configService.get<string>('app.staffPortalLoginUrl'),
    );
  }

  private async sendWelcomeEmail(
    user: User,
    temporaryPassword: string,
    templateName: string,
    notificationType: NotificationType,
    loginUrl?: string,
  ): Promise<void> {
    const loginUrlBlock = loginUrl
      ? `<p><strong>Sign in:</strong> <a href="${loginUrl}">${loginUrl}</a></p>`
      : '';

    try {
      await this.mailService.sendTemplateMail(user.email, templateName, {
        firstName: user.firstName,
        email: user.email,
        temporaryPassword,
        loginUrlBlock,
      });

      await this.notificationsService.log({
        userId: user.id,
        channel: NotificationChannel.EMAIL,
        type: notificationType,
        payload: { email: user.email },
        status: NotificationStatus.SENT,
        sentAt: new Date(),
      });
    } catch (error) {
      this.logger.error(
        `Failed to send ${templateName} email to ${user.email}`,
        error instanceof Error ? error.stack : undefined,
      );

      await this.notificationsService.log({
        userId: user.id,
        channel: NotificationChannel.EMAIL,
        type: notificationType,
        payload: {
          email: user.email,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        status: NotificationStatus.FAILED,
      });
    }
  }
}
