import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailModule } from '../mail/mail.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UserModule } from '../user/user.module';
import { Otp } from './entities/otp.entity';
import { OtpsService } from './otps.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Otp]),
    MailModule,
    NotificationsModule,
    UserModule,
  ],
  providers: [OtpsService],
  exports: [OtpsService],
})
export class OtpsModule {}
