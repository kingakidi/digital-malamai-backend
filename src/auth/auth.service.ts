import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { buildRolePermissionView } from '../common/utils/permission.util';
import { StudentsService } from '../students/students.service';
import { UserService } from '../user/user.service';
import { RegisterStudentDto } from './dto/register-student.dto';
import { SignInDto } from './dto/sign-in.dto';
import { StudentSignInDto } from './dto/student-sign-in.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly studentsService: StudentsService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(signInDto: SignInDto) {
    const user = await this.userService.findByEmail(signInDto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is inactive');
    }

    if (!user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(signInDto.password, user.password);

    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.buildAuthResponse(user);
  }

  registerStudent(dto: RegisterStudentDto) {
    return this.studentsService.register(dto);
  }

  async studentLogin(dto: StudentSignInDto) {
    const user = await this.studentsService.login(dto);
    return this.buildAuthResponse(user);
  }

  private async buildAuthResponse(user: Awaited<ReturnType<UserService['findByEmail']>>) {
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      sub: user.id,
      email: user.email,
    };

    const sanitized = this.userService.sanitizeUser(user);
    const rolePermissions = buildRolePermissionView(user.role.permissions);

    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: {
        ...sanitized,
        role: {
          ...sanitized.role,
          permissionKeys: rolePermissions.permissionKeys,
          permissionGroups: rolePermissions.permissionGroups,
        },
      },
    };
  }
}
