import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { RegisterStudentDto } from '../auth/dto/register-student.dto';
import { StudentSignInDto } from '../auth/dto/student-sign-in.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { ReportFilterQueryDto } from '../common/dto/report-filter-query.dto';
import { PaginatedResult } from '../common/interfaces/pagination.interface';
import { OnboardingStatus } from '../common/types/onboarding-status.type';
import { AccountStatus } from '../common/types/account-status.type';
import {
  assertAccountCanAuthenticate,
  registrationBlockMessage,
  syncAccountActiveFlag,
} from '../common/utils/account-access.util';
import { PartnerStatus } from '../common/types/partner-status.type';
import { RoleName } from '../common/types/permission.types';
import { SortOrder } from '../common/types/sort-order.type';
import {
  buildPaginatedResult,
  getPaginationSkip,
} from '../common/utils/pagination.util';
import { AccessCode } from '../access-codes/entities/access-code.entity';
import { PartnersService } from '../partners/partners.service';
import { RolesService } from '../roles/roles.service';
import { SettingsService } from '../settings/settings.service';
import { User } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';
import { OnboardingRegistrationInput } from './types/onboarding-registration.type';
import * as bcrypt from 'bcrypt';

@Injectable()
export class StudentsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly userService: UserService,
    private readonly rolesService: RolesService,
    private readonly partnersService: PartnersService,
    private readonly settingsService: SettingsService,
    @InjectRepository(AccessCode)
    private readonly accessCodesRepository: Repository<AccessCode>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async register(dto: RegisterStudentDto) {
    const partner = await this.assertRegistrationValid(dto);
    const systemFee = await this.settingsService.getOnboardingFee();
    const onboardingFee =
      await this.settingsService.resolveOnboardingFeeForPartner(
        partner.onboardingFee,
      );

    return {
      validated: true,
      email: dto.email.toLowerCase(),
      partnerId: dto.partnerId,
      onboardingFee,
      currency: systemFee.currency,
    };
  }

  async createStudentFromOnboardingPayment(
    manager: EntityManager,
    input: OnboardingRegistrationInput,
  ): Promise<User> {
    const existingEmail = await this.userService.findByEmail(
      input.email.toLowerCase(),
    );
    if (existingEmail) {
      throw new ConflictException(
        registrationBlockMessage(existingEmail, 'email'),
      );
    }

    const existingPhone = await this.userService.findByPhone(input.phone);
    if (existingPhone) {
      throw new ConflictException(
        registrationBlockMessage(existingPhone, 'phone'),
      );
    }

    const partner = await this.partnersService.findOneEntity(input.partnerId);
    if (partner.status !== PartnerStatus.ACTIVE) {
      throw new ConflictException('Partner is not active');
    }

    const studentRole = await this.rolesService.findByName(RoleName.STUDENT);
    if (!studentRole) {
      throw new NotFoundException('Student role is not configured');
    }

    const normalizedCode = input.accessCode.toUpperCase();
    const { firstName, lastName } = this.splitFullName(input.fullName);

    const accessCode = await manager
      .createQueryBuilder(AccessCode, 'accessCode')
      .setLock('pessimistic_write')
      .where('accessCode.code = :code', { code: normalizedCode })
      .andWhere('accessCode.partnerId = :partnerId', {
        partnerId: input.partnerId,
      })
      .getOne();

    if (!accessCode) {
      throw new ConflictException('Invalid access code for this partner');
    }

    if (accessCode.isUsed) {
      throw new ConflictException('Access code has already been used');
    }

    if (accessCode.expiresAt && accessCode.expiresAt < new Date()) {
      throw new ConflictException('Access code has expired');
    }

    const student = manager.create(User, {
      firstName,
      lastName,
      email: input.email.toLowerCase(),
      phone: input.phone,
      password: null,
      role: studentRole,
      partnerId: input.partnerId,
      accessCodeId: accessCode.id,
      onboardingStatus: OnboardingStatus.PENDING,
    });

    const savedStudent = await manager.save(student);

    accessCode.isUsed = true;
    accessCode.studentId = savedStudent.id;
    await manager.save(accessCode);

    return savedStudent;
  }

  async login(dto: StudentSignInDto) {
    const user = await this.userService.findStudentByIdentifier(dto.identifier);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    assertAccountCanAuthenticate(user);

    const isValid = await this.validateCredential(user, dto.credential);

    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }

  async getProfile(userId: string) {
    const user = await this.userService.findByIdWithRole(userId);

    if (!user) {
      throw new NotFoundException('Student not found');
    }

    return this.userService.sanitizeUser(user);
  }

  async findAllStudents(
    query: ReportFilterQueryDto,
  ): Promise<PaginatedResult<ReturnType<UserService['sanitizeUser']>>> {
    const skip = getPaginationSkip(query.page, query.limit);

    const qb = this.usersRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('user.partner', 'partner')
      .where('role.name = :roleName', { roleName: RoleName.STUDENT });

    if (query.partnerId) {
      qb.andWhere('user.partnerId = :partnerId', { partnerId: query.partnerId });
    }

    if (query.onboardingStatus) {
      qb.andWhere('user.onboardingStatus = :onboardingStatus', {
        onboardingStatus: query.onboardingStatus,
      });
    }

    if (query.isActive !== undefined) {
      qb.andWhere('user.isActive = :isActive', { isActive: query.isActive });
    }

    if (query.dateFrom) {
      qb.andWhere('user.createdAt >= :dateFrom', { dateFrom: query.dateFrom });
    }

    if (query.dateTo) {
      qb.andWhere('user.createdAt <= :dateTo', {
        dateTo: `${query.dateTo} 23:59:59`,
      });
    }

    if (query.search) {
      qb.andWhere(
        '(user.firstName LIKE :search OR user.lastName LIKE :search OR user.email LIKE :search OR user.phone LIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy('user.createdAt', query.sortOrder ?? SortOrder.DESC)
      .skip(skip)
      .take(query.limit);

    const [items, total] = await qb.getManyAndCount();
    return buildPaginatedResult(
      items.map((user) => this.userService.sanitizeUser(user)),
      total,
      query,
    );
  }

  async findStudentsForPartner(
    partnerId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<ReturnType<UserService['sanitizeUser']>>> {
    const skip = getPaginationSkip(query.page, query.limit);

    const qb = this.usersRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .where('role.name = :roleName', { roleName: RoleName.STUDENT })
      .andWhere('user.partnerId = :partnerId', { partnerId });

    if (query.search) {
      qb.andWhere(
        '(user.firstName LIKE :search OR user.lastName LIKE :search OR user.email LIKE :search OR user.phone LIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy('user.createdAt', query.sortOrder ?? SortOrder.DESC)
      .skip(skip)
      .take(query.limit);

    const [items, total] = await qb.getManyAndCount();
    return buildPaginatedResult(
      items.map((user) => this.userService.sanitizeUser(user)),
      total,
      query,
    );
  }

  private async assertRegistrationValid(dto: RegisterStudentDto) {
    const partner = await this.partnersService.findOneEntity(dto.partnerId);

    if (partner.status !== PartnerStatus.ACTIVE) {
      throw new ConflictException('Partner is not active');
    }

    const existingEmail = await this.userService.findByEmail(
      dto.email.toLowerCase(),
    );
    if (existingEmail) {
      throw new ConflictException('Email already exists');
    }

    const existingPhone = await this.userService.findByPhone(dto.phone);
    if (existingPhone) {
      throw new ConflictException('Phone number already exists');
    }

    const normalizedCode = dto.accessCode.toUpperCase();
    const accessCode = await this.accessCodesRepository.findOne({
      where: { code: normalizedCode, partnerId: dto.partnerId },
    });

    if (!accessCode) {
      throw new ConflictException('Invalid access code for this partner');
    }

    if (accessCode.isUsed) {
      throw new ConflictException('Access code has already been used');
    }

    if (accessCode.expiresAt && accessCode.expiresAt < new Date()) {
      throw new ConflictException('Access code has expired');
    }

    return partner;
  }

  async validateCredential(user: User, credential: string): Promise<boolean> {
    if (user.password) {
      return bcrypt.compare(credential, user.password);
    }

    if (!user.accessCodeId) {
      return false;
    }

    const accessCode = await this.accessCodesRepository.findOneBy({
      id: user.accessCodeId,
    });

    return accessCode?.code === credential.toUpperCase();
  }

  async patchStudentAccount(
    id: string,
    accountStatus: AccountStatus,
  ): Promise<User> {
    const user = await this.userService.findByIdWithRole(id);

    if (!user || user.role.name !== RoleName.STUDENT) {
      throw new NotFoundException(`Student ${id} not found`);
    }

    user.accountStatus = accountStatus;
    user.isActive = syncAccountActiveFlag(accountStatus);
    return this.usersRepository.save(user);
  }

  private splitFullName(fullName: string): {
    firstName: string;
    lastName: string;
  } {
    const trimmed = fullName.trim();
    const spaceIndex = trimmed.indexOf(' ');

    if (spaceIndex === -1) {
      return { firstName: trimmed, lastName: trimmed };
    }

    return {
      firstName: trimmed.slice(0, spaceIndex),
      lastName: trimmed.slice(spaceIndex + 1).trim() || trimmed.slice(0, spaceIndex),
    };
  }
}
