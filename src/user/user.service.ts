import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { AbacService } from '../common/abac/abac.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { PaginatedResult } from '../common/interfaces/pagination.interface';
import { SortOrder } from '../common/types/sort-order.type';
import {
  PermissionAction,
  PermissionResource,
  PermissionScope,
  RoleName,
} from '../common/types/permission.types';
import { generateTemporaryPassword } from '../common/utils/password.util';
import {
  buildPaginatedResult,
  getPaginationSkip,
} from '../common/utils/pagination.util';
import { STAFF_ACCOUNT_ROLES } from '../common/constants/staff-roles.constants';
import { AccountStatus } from '../common/types/account-status.type';
import {
  registrationBlockMessage,
  syncAccountActiveFlag,
} from '../common/utils/account-access.util';
import { AccountWelcomeService } from '../mail/account-welcome.service';
import { RolesService } from '../roles/roles.service';
import { AdminPatchUserDto } from './dto/admin-patch-user.dto';
import { CreateStaffUserDto } from './dto/create-staff-user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';

const ALLOWED_SORT_FIELDS = [
  'id',
  'firstName',
  'lastName',
  'email',
  'createdAt',
  'updatedAt',
];

@Injectable()
export class UserService {
  constructor(
    private readonly rolesService: RolesService,
    private readonly abacService: AbacService,
    private readonly accountWelcomeService: AccountWelcomeService,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const role = await this.rolesService.findEntityById(createUserDto.roleId);

    if (
      (STAFF_ACCOUNT_ROLES as readonly RoleName[]).includes(
        role.name as RoleName,
      )
    ) {
      throw new ForbiddenException(
        'Staff accounts can only be created by a superadmin via POST /admin/users',
      );
    }

    const normalizedEmail = createUserDto.email.trim().toLowerCase();
    await this.assertEmailAvailable(normalizedEmail);

    const user = this.usersRepository.create({
      firstName: createUserDto.firstName,
      lastName: createUserDto.lastName,
      email: normalizedEmail,
      password: createUserDto.password,
      mustChangePassword: false,
      role,
      partnerId: createUserDto.partnerId ?? null,
    });

    return this.usersRepository.save(user);
  }

  async createStaffAccount(dto: CreateStaffUserDto): Promise<User> {
    const role = await this.rolesService.findEntityById(dto.roleId);
    this.assertStaffRole(role.name as RoleName);

    if (role.name === RoleName.PARTNER) {
      throw new BadRequestException(
        'Partner accounts must be created via POST /admin/partners',
      );
    }

    if (role.name === RoleName.SUPERADMIN) {
      throw new BadRequestException(
        'Superadmin accounts cannot be created via this endpoint',
      );
    }

    const normalizedEmail = dto.email.trim().toLowerCase();
    await this.assertEmailAvailable(normalizedEmail);

    const plainPassword = dto.password?.trim() || generateTemporaryPassword();

    const user = this.usersRepository.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: normalizedEmail,
      password: plainPassword,
      mustChangePassword: true,
      role,
      partnerId: null,
    });

    const savedUser = await this.usersRepository.save(user);
    this.accountWelcomeService.dispatchStaffWelcomeEmail(savedUser, plainPassword);

    return savedUser;
  }

  async resendStaffWelcomeEmail(userId: string) {
    const user = await this.findByIdWithRole(userId);

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    if (user.role.name === RoleName.STUDENT) {
      throw new BadRequestException(
        'Welcome emails are not sent for student accounts',
      );
    }

    if (user.role.name === RoleName.PARTNER) {
      throw new BadRequestException(
        'Resend partner welcome emails via POST /admin/partners/:id/resend-welcome-email',
      );
    }

    if (user.role.name === RoleName.SUPERADMIN) {
      throw new BadRequestException(
        'Welcome emails cannot be resent for superadmin accounts',
      );
    }

    const plainPassword = generateTemporaryPassword();
    const updatedUser = await this.setPassword(user.id, plainPassword, {
      mustChangePassword: true,
    });

    this.accountWelcomeService.dispatchStaffWelcomeEmail(
      updatedUser,
      plainPassword,
    );

    return { message: 'Welcome email has been queued' };
  }

  async changePasswordWithCurrent(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.findByIdWithRole(userId);

    if (!user?.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.role.name === RoleName.STUDENT) {
      throw new BadRequestException(
        'Students should change password via /students/change-password',
      );
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);

    if (!isMatch) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    await this.setPassword(user.id, newPassword, { mustChangePassword: false });

    return { message: 'Password changed successfully' };
  }

  async updateOwnProfile(
    userId: string,
    dto: { firstName: string; lastName: string },
  ) {
    const user = await this.findByIdWithRole(userId);

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    user.firstName = dto.firstName.trim();
    user.lastName = dto.lastName.trim();
    await this.usersRepository.save(user);

    return this.findByIdWithRole(userId);
  }

  async countPartnerRoleUsers(partnerId: string): Promise<number> {
    return this.usersRepository
      .createQueryBuilder('user')
      .innerJoin('user.role', 'role')
      .where('user.partnerId = :partnerId', { partnerId })
      .andWhere('role.name = :roleName', { roleName: RoleName.PARTNER })
      .getCount();
  }

  async listPartnerTeamUsers(partnerId: string) {
    const users = await this.usersRepository
      .createQueryBuilder('user')
      .innerJoinAndSelect('user.role', 'role')
      .where('user.partnerId = :partnerId', { partnerId })
      .andWhere('role.name = :roleName', { roleName: RoleName.PARTNER })
      .orderBy('user.createdAt', 'ASC')
      .getMany();

    return users.slice(1).map((user) => this.toPartnerTeamUser(user, partnerId));
  }

  async createPartnerTeamUser(
    partnerId: string,
    dto: {
      firstName: string;
      lastName: string;
      email: string;
      password: string;
    },
  ) {
    const count = await this.countPartnerRoleUsers(partnerId);

    if (count >= 6) {
      throw new BadRequestException(
        'Maximum of 5 additional team users reached for this partner',
      );
    }

    const partnerRole = await this.rolesService.findByName(RoleName.PARTNER);

    if (!partnerRole) {
      throw new NotFoundException('Partner role is not configured');
    }

    const normalizedEmail = dto.email.trim().toLowerCase();
    await this.assertEmailAvailable(normalizedEmail);

    const user = this.usersRepository.create({
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      email: normalizedEmail,
      password: dto.password,
      mustChangePassword: true,
      role: partnerRole,
      partnerId,
    });

    const saved = await this.usersRepository.save(user);
    return this.toPartnerTeamUser(saved, partnerId);
  }

  async updatePartnerTeamUser(
    partnerId: string,
    userId: string,
    dto: {
      firstName?: string;
      lastName?: string;
      isActive?: boolean;
      accountStatus?: AccountStatus;
    },
  ) {
    const user = await this.findPartnerTeamUser(partnerId, userId);

    if (dto.firstName !== undefined) {
      user.firstName = dto.firstName.trim();
    }
    if (dto.lastName !== undefined) {
      user.lastName = dto.lastName.trim();
    }
    if (dto.isActive !== undefined) {
      user.isActive = dto.isActive;
      if (dto.accountStatus === undefined) {
        user.accountStatus = dto.isActive
          ? AccountStatus.ACTIVE
          : AccountStatus.DISABLED;
      }
    }
    if (dto.accountStatus !== undefined) {
      user.accountStatus = dto.accountStatus;
      user.isActive = syncAccountActiveFlag(dto.accountStatus);
    }

    const saved = await this.usersRepository.save(user);
    return this.toPartnerTeamUser(saved, partnerId);
  }

  async removePartnerTeamUser(partnerId: string, userId: string) {
    const user = await this.findPartnerTeamUser(partnerId, userId);
    user.accountStatus = AccountStatus.DISABLED;
    user.isActive = false;
    await this.usersRepository.save(user);
    return { message: 'Team member disabled successfully' };
  }

  private async findPartnerTeamUser(partnerId: string, userId: string) {
    const users = await this.usersRepository
      .createQueryBuilder('user')
      .innerJoinAndSelect('user.role', 'role')
      .where('user.partnerId = :partnerId', { partnerId })
      .andWhere('role.name = :roleName', { roleName: RoleName.PARTNER })
      .orderBy('user.createdAt', 'ASC')
      .getMany();

    const primaryId = users[0]?.id;
    const user = users.find((item) => item.id === userId);

    if (!user || user.id === primaryId) {
      throw new NotFoundException('Team member not found');
    }

    return user;
  }

  private toPartnerTeamUser(user: User, partnerId: string) {
    return {
      id: user.id,
      partnerId,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }

  async createSuperadminSeedUser(dto: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    roleId: string;
  }): Promise<User> {
    const normalizedEmail = dto.email.trim().toLowerCase();
    await this.assertEmailAvailable(normalizedEmail);

    const role = await this.rolesService.findEntityById(dto.roleId);

    const user = this.usersRepository.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: normalizedEmail,
      password: dto.password,
      mustChangePassword: false,
      role,
      partnerId: null,
    });

    return this.usersRepository.save(user);
  }

  async assertEmailAvailable(
    email: string,
    excludeUserId?: string,
  ): Promise<void> {
    const existing = await this.findByEmail(email);

    if (existing && existing.id !== excludeUserId) {
      throw new ConflictException(registrationBlockMessage(existing, 'email'));
    }
  }

  async assertPhoneAvailable(
    phone: string,
    excludeUserId?: string,
  ): Promise<void> {
    const existing = await this.findByPhone(phone);

    if (existing && existing.id !== excludeUserId) {
      throw new ConflictException(registrationBlockMessage(existing, 'phone'));
    }
  }

  async findAllStaff(
    currentUser: AuthenticatedUser,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<User>> {
    const scope = this.abacService.resolveScope(
      currentUser,
      PermissionResource.USERS,
      PermissionAction.READ,
    );

    if (!scope) {
      throw new ForbiddenException('Cannot read users');
    }

    const skip = getPaginationSkip(query.page, query.limit);
    const sortBy = ALLOWED_SORT_FIELDS.includes(query.sortBy ?? '')
      ? query.sortBy!
      : 'createdAt';

    const qb = this.usersRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .andWhere('role.name IN (:...staffRoles)', {
        staffRoles: STAFF_ACCOUNT_ROLES,
      });

    this.applyScopeFilter(qb, scope, currentUser);

    if (query.search) {
      qb.andWhere(
        '(user.firstName LIKE :search OR user.lastName LIKE :search OR user.email LIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    if (query.role) {
      qb.andWhere('role.name = :roleName', { roleName: query.role });
    }

    qb.orderBy(`user.${sortBy}`, query.sortOrder ?? SortOrder.DESC)
      .skip(skip)
      .take(query.limit);

    const [items, total] = await qb.getManyAndCount();
    return buildPaginatedResult(items, total, query);
  }

  async patchStaffAccount(
    id: string,
    dto: AdminPatchUserDto,
    currentUser: AuthenticatedUser,
  ): Promise<User> {
    const user = await this.findByIdWithRole(id);

    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    if (user.role.name === RoleName.STUDENT) {
      throw new BadRequestException(
        'Student accounts are not managed via admin users',
      );
    }

    this.assertUserAccess(currentUser, user, PermissionAction.UPDATE);

    if (dto.roleId) {
      const role = await this.rolesService.findEntityById(dto.roleId);
      this.assertStaffRole(role.name as RoleName);
      user.role = role;
    }

    if (dto.firstName !== undefined) {
      user.firstName = dto.firstName;
    }

    if (dto.lastName !== undefined) {
      user.lastName = dto.lastName;
    }

    if (dto.email !== undefined) {
      const normalizedEmail = dto.email.trim().toLowerCase();
      if (normalizedEmail !== user.email.toLowerCase()) {
        await this.assertEmailAvailable(normalizedEmail, user.id);
        user.email = normalizedEmail;
      }
    }

    if (dto.partnerId !== undefined) {
      user.partnerId = dto.partnerId;
    }

    if (dto.isActive !== undefined) {
      user.isActive = dto.isActive;
      if (dto.accountStatus === undefined) {
        user.accountStatus = dto.isActive
          ? AccountStatus.ACTIVE
          : AccountStatus.DISABLED;
      }
    }

    if (dto.accountStatus !== undefined) {
      user.accountStatus = dto.accountStatus;
      user.isActive = syncAccountActiveFlag(dto.accountStatus);
    }

    await this.usersRepository.save(user);
    return this.findOne(id, currentUser);
  }

  async findAll(
    currentUser: AuthenticatedUser,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<User>> {
    const scope = this.abacService.resolveScope(
      currentUser,
      PermissionResource.USERS,
      PermissionAction.READ,
    );

    if (!scope) {
      throw new ForbiddenException('Cannot read users');
    }

    const skip = getPaginationSkip(query.page, query.limit);
    const sortBy = ALLOWED_SORT_FIELDS.includes(query.sortBy ?? '')
      ? query.sortBy!
      : 'createdAt';

    const qb = this.usersRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role');

    this.applyScopeFilter(qb, scope, currentUser);

    if (query.search) {
      qb.andWhere(
        '(user.firstName LIKE :search OR user.lastName LIKE :search OR user.email LIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy(`user.${sortBy}`, query.sortOrder ?? SortOrder.DESC)
      .skip(skip)
      .take(query.limit);

    const [items, total] = await qb.getManyAndCount();
    return buildPaginatedResult(items, total, query);
  }

  async findOne(id: string, currentUser: AuthenticatedUser): Promise<User> {
    const user = await this.findByIdWithRole(id);

    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    this.assertUserAccess(currentUser, user, PermissionAction.READ);
    return user;
  }

  async findByIdWithRole(id: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { id },
      relations: ['role'],
    });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .where('LOWER(user.email) = LOWER(:email)', { email: email.trim() })
      .getOne();
  }

  findPartnerLoginByPartnerId(partnerId: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .where('user.partnerId = :partnerId', { partnerId })
      .andWhere('role.name = :roleName', { roleName: RoleName.PARTNER })
      .getOne();
  }

  async setPassword(
    userId: string,
    plainPassword: string,
    options?: { mustChangePassword?: boolean },
  ): Promise<User> {
    const user = await this.findByIdWithRole(userId);

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    user.password = await bcrypt.hash(plainPassword, 10);

    if (options?.mustChangePassword !== undefined) {
      user.mustChangePassword = options.mustChangePassword;
    }

    return this.usersRepository.save(user);
  }

  findByPhone(phone: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { phone },
      relations: ['role'],
    });
  }

  findStudentByIdentifier(identifier: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .where('role.name = :roleName', { roleName: RoleName.STUDENT })
      .andWhere(
        '(LOWER(user.email) = LOWER(:identifier) OR user.phone = :identifier)',
        { identifier },
      )
      .getOne();
  }

  findByIdentifier(identifier: string): Promise<User | null> {
    const trimmed = identifier.trim();
    return this.usersRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .where(
        '(LOWER(user.email) = LOWER(:identifier) OR user.phone = :identifier)',
        { identifier: trimmed },
      )
      .getOne();
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    currentUser: AuthenticatedUser,
  ): Promise<User> {
    const user = await this.findByIdWithRole(id);

    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    this.assertUserAccess(currentUser, user, PermissionAction.UPDATE);

    if (updateUserDto.roleId) {
      user.role = await this.rolesService.findEntityById(updateUserDto.roleId);
    }

    if (updateUserDto.firstName !== undefined) {
      user.firstName = updateUserDto.firstName;
    }
    if (updateUserDto.lastName !== undefined) {
      user.lastName = updateUserDto.lastName;
    }
    if (updateUserDto.email !== undefined) {
      const normalizedEmail = updateUserDto.email.trim().toLowerCase();
      if (normalizedEmail !== user.email.toLowerCase()) {
        await this.assertEmailAvailable(normalizedEmail, user.id);
        user.email = normalizedEmail;
      }
    }
    if (updateUserDto.partnerId !== undefined) {
      user.partnerId = updateUserDto.partnerId;
    }

    await this.usersRepository.save(user);
    return this.findOne(id, currentUser);
  }

  async remove(id: string, currentUser: AuthenticatedUser): Promise<void> {
    const user = await this.findByIdWithRole(id);

    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    this.assertUserAccess(currentUser, user, PermissionAction.DELETE);
    user.accountStatus = AccountStatus.DISABLED;
    user.isActive = false;
    await this.usersRepository.save(user);
  }

  async findUserIdsByPartnerId(partnerId: string): Promise<string[]> {
    const users = await this.usersRepository.find({
      where: { partnerId },
      select: ['id'],
    });
    return users.map((user) => user.id);
  }

  sanitizeUser(user: User) {
    const { password, ...result } = user;
    return result;
  }

  save(user: User): Promise<User> {
    return this.usersRepository.save(user);
  }

  private assertStaffRole(roleName: RoleName): void {
    if (!(STAFF_ACCOUNT_ROLES as readonly RoleName[]).includes(roleName)) {
      throw new BadRequestException(
        'Only staff or partner roles can be managed via admin users',
      );
    }
  }

  private applyScopeFilter(
    qb: ReturnType<Repository<User>['createQueryBuilder']>,
    scope: PermissionScope,
    currentUser: AuthenticatedUser,
  ): void {
    switch (scope) {
      case PermissionScope.ALL:
        break;
      case PermissionScope.OWN:
        qb.andWhere('user.id = :userId', { userId: currentUser.id });
        break;
      case PermissionScope.LINKED:
        if (!currentUser.partnerId) {
          qb.andWhere('1 = 0');
          break;
        }
        qb.andWhere('user.partnerId = :partnerId', {
          partnerId: currentUser.partnerId,
        });
        break;
      default:
        qb.andWhere('1 = 0');
    }
  }

  private assertUserAccess(
    currentUser: AuthenticatedUser,
    targetUser: User,
    action: PermissionAction,
  ): void {
    const scope = this.abacService.resolveScope(
      currentUser,
      PermissionResource.USERS,
      action,
    );

    if (!scope) {
      throw new ForbiddenException(`Cannot ${action} users`);
    }

    if (scope === PermissionScope.ALL) {
      return;
    }

    if (scope === PermissionScope.OWN && currentUser.id === targetUser.id) {
      return;
    }

    if (
      scope === PermissionScope.LINKED &&
      currentUser.partnerId &&
      targetUser.partnerId === currentUser.partnerId
    ) {
      return;
    }

    throw new ForbiddenException(`Cannot ${action} this user`);
  }
}
