import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
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
import {
  buildPaginatedResult,
  getPaginationSkip,
} from '../common/utils/pagination.util';
import { STAFF_ACCOUNT_ROLES } from '../common/constants/staff-roles.constants';
import { RolesService } from '../roles/roles.service';
import { AdminPatchUserDto } from './dto/admin-patch-user.dto';
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
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const role = await this.rolesService.findEntityById(createUserDto.roleId);

    const user = this.usersRepository.create({
      firstName: createUserDto.firstName,
      lastName: createUserDto.lastName,
      email: createUserDto.email,
      password: createUserDto.password,
      role,
      partnerId: createUserDto.partnerId ?? null,
    });

    return this.usersRepository.save(user);
  }

  async createStaffAccount(createUserDto: CreateUserDto): Promise<User> {
    const role = await this.rolesService.findEntityById(createUserDto.roleId);
    this.assertStaffRole(role.name as RoleName);

    if (role.name === RoleName.PARTNER && !createUserDto.partnerId) {
      throw new BadRequestException(
        'partnerId is required when creating a partner login account',
      );
    }

    return this.create(createUserDto);
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
      user.email = dto.email;
    }

    if (dto.partnerId !== undefined) {
      user.partnerId = dto.partnerId;
    }

    if (dto.isActive !== undefined) {
      user.isActive = dto.isActive;
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
    return this.usersRepository.findOne({
      where: { email },
      relations: ['role'],
    });
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
      user.email = updateUserDto.email;
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
    await this.usersRepository.delete(id);
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
