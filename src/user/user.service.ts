import {
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
} from '../common/types/permission.types';
import {
  buildPaginatedResult,
  getPaginationSkip,
} from '../common/utils/pagination.util';
import { RolesService } from '../roles/roles.service';
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

    this.applyScopeFilter(qb, scope, currentUser.id);

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

  async findOne(id: number, currentUser: AuthenticatedUser): Promise<User> {
    const user = await this.findByIdWithRole(id);

    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    this.assertUserAccess(currentUser, user, PermissionAction.READ);
    return user;
  }

  async findByIdWithRole(id: number): Promise<User | null> {
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

  async update(
    id: number,
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

  async remove(id: number, currentUser: AuthenticatedUser): Promise<void> {
    const user = await this.findByIdWithRole(id);

    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    this.assertUserAccess(currentUser, user, PermissionAction.DELETE);
    await this.usersRepository.delete(id);
  }

  async findLinkedUserIds(partnerId: number): Promise<number[]> {
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

  private applyScopeFilter(
    qb: ReturnType<Repository<User>['createQueryBuilder']>,
    scope: PermissionScope,
    userId: number,
  ): void {
    switch (scope) {
      case PermissionScope.ALL:
        break;
      case PermissionScope.OWN:
        qb.andWhere('user.id = :userId', { userId });
        break;
      case PermissionScope.LINKED:
        qb.andWhere('user.partnerId = :userId', { userId });
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
      targetUser.partnerId === currentUser.id
    ) {
      return;
    }

    throw new ForbiddenException(`Cannot ${action} this user`);
  }
}
