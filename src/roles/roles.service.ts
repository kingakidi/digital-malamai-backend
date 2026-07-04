import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DEFAULT_ROLES } from '../common/constants/default-role-permissions.constants';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResult } from '../common/interfaces/pagination.interface';
import { PermissionGroupDefinition } from '../common/interfaces/permission-catalog.interface';
import { SortOrder } from '../common/types/sort-order.type';
import { RoleName } from '../common/types/permission.types';
import {
  buildPaginatedResult,
  getPaginationSkip,
} from '../common/utils/pagination.util';
import {
  buildRolePermissionView,
  getPermissionCatalog,
  resolvePermissionKeys,
} from '../common/utils/permission.util';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { Role } from './entities/role.entity';
import { SerializedRole } from './types/serialized-role.type';

const ALLOWED_SORT_FIELDS = ['id', 'name', 'title', 'createdAt', 'updatedAt'];

@Injectable()
export class RolesService implements OnModuleInit {
  constructor(
    @InjectRepository(Role)
    private readonly rolesRepository: Repository<Role>,
  ) {}

  async onModuleInit(): Promise<void> {
    const legacyStudent = await this.rolesRepository.findOneBy({ name: 'user' });

    if (legacyStudent) {
      legacyStudent.name = RoleName.STUDENT;
      legacyStudent.title = 'Student';
      await this.rolesRepository.save(legacyStudent);
    }

    for (const roleDefinition of DEFAULT_ROLES) {
      const existing = await this.rolesRepository.findOneBy({
        name: roleDefinition.name,
      });

      if (!existing) {
        await this.rolesRepository.save({
          name: roleDefinition.name,
          title: roleDefinition.title,
          permissions: roleDefinition.permissions,
        });
      }
    }
  }

  getPermissionGroups(): PermissionGroupDefinition[] {
    return getPermissionCatalog();
  }

  async create(createRoleDto: CreateRoleDto): Promise<SerializedRole> {
    const permissions = resolvePermissionKeys(createRoleDto.permissionKeys);
    const role = this.rolesRepository.create({
      name: createRoleDto.name,
      title: createRoleDto.title,
      permissions,
    });
    const saved = await this.rolesRepository.save(role);
    return this.serializeRole(saved);
  }

  async findAll(
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<SerializedRole>> {
    const skip = getPaginationSkip(query.page, query.limit);
    const sortBy = ALLOWED_SORT_FIELDS.includes(query.sortBy ?? '')
      ? query.sortBy!
      : 'id';

    const qb = this.rolesRepository.createQueryBuilder('role');

    if (query.search) {
      qb.andWhere('(role.name LIKE :search OR role.title LIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    qb.orderBy(`role.${sortBy}`, query.sortOrder ?? SortOrder.ASC)
      .skip(skip)
      .take(query.limit);

    const [items, total] = await qb.getManyAndCount();
    return buildPaginatedResult(
      items.map((role) => this.serializeRole(role)),
      total,
      query,
    );
  }

  async findOne(id: string): Promise<SerializedRole> {
    const role = await this.rolesRepository.findOneBy({ id });

    if (!role) {
      throw new NotFoundException(`Role ${id} not found`);
    }

    return this.serializeRole(role);
  }

  findByName(name: string): Promise<Role | null> {
    return this.rolesRepository.findOneBy({ name });
  }

  findByTitle(title: string): Promise<Role | null> {
    return this.rolesRepository.findOneBy({ title });
  }

  async update(id: string, updateRoleDto: UpdateRoleDto): Promise<SerializedRole> {
    const role = await this.findOneEntity(id);

    if (updateRoleDto.title !== undefined) {
      role.title = updateRoleDto.title;
    }

    if (updateRoleDto.permissionKeys !== undefined) {
      role.permissions = resolvePermissionKeys(updateRoleDto.permissionKeys);
    }

    const saved = await this.rolesRepository.save(role);
    return this.serializeRole(saved);
  }

  async remove(id: string): Promise<void> {
    await this.findOneEntity(id);
    await this.rolesRepository.delete(id);
  }

  async findEntityById(id: string): Promise<Role> {
    return this.findOneEntity(id);
  }

  private async findOneEntity(id: string): Promise<Role> {
    const role = await this.rolesRepository.findOneBy({ id });

    if (!role) {
      throw new NotFoundException(`Role ${id} not found`);
    }

    return role;
  }

  private serializeRole(role: Role): SerializedRole {
    const permissionView = buildRolePermissionView(role.permissions);

    return {
      id: role.id,
      name: role.name,
      title: role.title,
      permissions: role.permissions,
      permissionKeys: permissionView.permissionKeys,
      permissionGroups: permissionView.permissionGroups,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }
}
