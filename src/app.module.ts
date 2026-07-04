import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessCodesModule } from './access-codes/access-codes.module';
import { AbacModule } from './common/abac/abac.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { RequestDebugInterceptor } from './common/interceptors/request-debug.interceptor';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import appConfig from './config/app.config';
import superadminConfig from './config/superadmin.config';
import databaseConfig from './config/database.config';
import { validateEnvironment } from './config/env.validation';
import flutterwaveConfig from './config/flutterwave.config';
import messagingConfig from './config/messaging.config';
import otpConfig from './config/otp.config';
import smtpConfig from './config/smtp.config';
import jwtConfig from './config/jwt.config';
import { AuthModule } from './auth/auth.module';
import { CoursesModule } from './courses/courses.module';
import { MailModule } from './mail/mail.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OtpsModule } from './otps/otps.module';
import { PartnersModule } from './partners/partners.module';
import { PaymentsModule } from './payments/payments.module';
import { RolesModule } from './roles/roles.module';
import { SettingsModule } from './settings/settings.module';
import { StudentsModule } from './students/students.module';
import { UserModule } from './user/user.module';
import { AdminModule } from './admin/admin.module';
import { WelcomeModule } from './welcome/welcome.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
      load: [
        databaseConfig,
        jwtConfig,
        appConfig,
        superadminConfig,
        smtpConfig,
        otpConfig,
        messagingConfig,
        flutterwaveConfig,
      ],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        username: configService.get<string>('database.username'),
        password: configService.get<string>('database.password'),
        database: configService.get<string>('database.database'),
        autoLoadEntities: true,
        synchronize: configService.get<boolean>('database.synchronize'),
      }),
    }),
    AbacModule,
    WelcomeModule,
    RolesModule,
    UserModule,
    AuthModule,
    MailModule,
    NotificationsModule,
    OtpsModule,
    PartnersModule,
    AccessCodesModule,
    StudentsModule,
    SettingsModule,
    CoursesModule,
    PaymentsModule,
    AdminModule,
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_INTERCEPTOR, useClass: RequestDebugInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
