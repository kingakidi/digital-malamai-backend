import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PermissionGuard } from '../common/abac/guards/permission.guard';
import { JwtAuthGuard } from '../common/abac/guards/jwt-auth.guard';
import { OtpsModule } from '../otps/otps.module';
import { PaymentsModule } from '../payments/payments.module';
import { StudentsModule } from '../students/students.module';
import { UserModule } from '../user/user.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [
    forwardRef(() => UserModule),
    forwardRef(() => StudentsModule),
    forwardRef(() => PaymentsModule),
    OtpsModule,
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret') ?? '',
        signOptions: {
          expiresIn: (configService.get<string>('jwt.expiresIn') ??
            '1d') as `${number}d`,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, PermissionGuard],
  exports: [
    AuthService,
    JwtAuthGuard,
    PermissionGuard,
    forwardRef(() => UserModule),
  ],
})
export class AuthModule {}
