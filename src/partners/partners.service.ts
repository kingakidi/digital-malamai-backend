import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResult } from '../common/interfaces/pagination.interface';
import { PartnerStatus } from '../common/types/partner-status.type';
import { CommissionType } from '../common/types/payment.types';
import { RoleName } from '../common/types/permission.types';
import { SortOrder } from '../common/types/sort-order.type';
import { generateTemporaryPassword } from '../common/utils/password.util';
import {
  buildPaginatedResult,
  getPaginationSkip,
} from '../common/utils/pagination.util';
import { RolesService } from '../roles/roles.service';
import { User } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';
import { ChangePartnerPasswordDto } from './dto/change-partner-password.dto';
import { CreatePartnerWithUserDto } from './dto/create-partner-with-user.dto';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { UpdatePartnerFeesDto } from './dto/update-partner-fees.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';
import { Partner } from './entities/partner.entity';
import { PublicPartnerView } from './types/public-partner-view.type';
import { toPublicPartner } from './utils/partner-view.util';
import { AccountWelcomeService } from '../mail/account-welcome.service';
import { S3Service } from '../media/s3.service';
import { AccessCode } from '../access-codes/entities/access-code.entity';

const ALLOWED_SORT_FIELDS = [
  'id',
  'firstName',
  'lastName',
  'email',
  'createdAt',
  'updatedAt',
];

export type PartnerWithCounts = Partner & {
  studentCount: number;
  accessCodeCount: number;
};

@Injectable()
export class PartnersService {
  constructor(
    @InjectRepository(Partner)
    private readonly partnersRepository: Repository<Partner>,
    private readonly dataSource: DataSource,
    private readonly rolesService: RolesService,
    private readonly userService: UserService,
    private readonly accountWelcomeService: AccountWelcomeService,
    private readonly s3Service: S3Service,
  ) {}

  private assertCommissionValid(
    commissionType?: CommissionType | null,
    commissionValue?: number | null,
  ): void {
    if (
      commissionType === CommissionType.PERCENTAGE &&
      commissionValue != null &&
      Number(commissionValue) > 100
    ) {
      throw new BadRequestException(
        'Commission percentage cannot be greater than 100',
      );
    }
  }

  async create(createPartnerDto: CreatePartnerDto): Promise<Partner> {
    const normalizedEmail = createPartnerDto.email.trim().toLowerCase();
    await this.assertPartnerEmailAvailable(normalizedEmail);
    await this.userService.assertEmailAvailable(normalizedEmail);
    this.assertCommissionValid(
      createPartnerDto.commissionType,
      createPartnerDto.commissionValue,
    );

    const partner = this.partnersRepository.create({
      ...createPartnerDto,
      email: normalizedEmail,
    });
    return this.partnersRepository.save(partner);
  }

  async createWithUser(dto: CreatePartnerWithUserDto) {
    const normalizedEmail = dto.email.trim().toLowerCase();
    await this.assertPartnerEmailAvailable(normalizedEmail);
    await this.userService.assertEmailAvailable(normalizedEmail);
    this.assertCommissionValid(dto.commissionType, dto.commissionValue);

    const partnerRole = await this.rolesService.findByName(RoleName.PARTNER);

    if (!partnerRole) {
      throw new NotFoundException('Partner role is not configured');
    }

    const plainPassword = dto.password?.trim() || generateTemporaryPassword();

    const result = await this.dataSource.transaction(async (manager) => {
      const partner = manager.create(Partner, {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: normalizedEmail,
        phoneNumber: dto.phoneNumber ?? null,
        address: dto.address ?? null,
        description: dto.description ?? null,
        logoUrl: dto.logoUrl ?? null,
        onboardingFee: dto.onboardingFee ?? null,
        commissionType: dto.commissionType ?? null,
        commissionValue: dto.commissionValue ?? null,
        onboardPercentage: dto.onboardPercentage ?? 0,
        status: dto.status ?? PartnerStatus.ACTIVE,
      });

      const savedPartner = await manager.save(partner);

      const user = manager.create(User, {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: normalizedEmail,
        password: plainPassword,
        mustChangePassword: true,
        role: partnerRole,
        partnerId: savedPartner.id,
      });

      const savedUser = await manager.save(user);

      return {
        partner: savedPartner,
        user: savedUser,
      };
    });

    this.accountWelcomeService.dispatchPartnerWelcomeEmail(
      result.user,
      plainPassword,
    );

    return {
      partner: result.partner,
      user: this.userService.sanitizeUser(result.user),
    };
  }

  async resendWelcomeEmail(partnerId: string) {
    await this.findOneEntity(partnerId);

    const user = await this.userService.findPartnerLoginByPartnerId(partnerId);

    if (!user) {
      throw new NotFoundException(
        `No partner login account is linked to partner ${partnerId}`,
      );
    }

    const plainPassword = generateTemporaryPassword();
    const updatedUser = await this.userService.setPassword(user.id, plainPassword, {
      mustChangePassword: true,
    });

    this.accountWelcomeService.dispatchPartnerWelcomeEmail(
      updatedUser,
      plainPassword,
    );

    return { message: 'Welcome email has been queued' };
  }

  async changeOwnPassword(userId: string, dto: ChangePartnerPasswordDto) {
    return this.userService.changePasswordWithCurrent(
      userId,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  async findAllActive(
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<PublicPartnerView>> {
    const skip = getPaginationSkip(query.page, query.limit);
    const sortBy = ALLOWED_SORT_FIELDS.includes(query.sortBy ?? '')
      ? query.sortBy!
      : 'firstName';

    const qb = this.partnersRepository
      .createQueryBuilder('partner')
      .where('partner.status = :status', { status: PartnerStatus.ACTIVE });

    if (query.search) {
      qb.andWhere(
        '(partner.firstName LIKE :search OR partner.lastName LIKE :search OR partner.email LIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy(`partner.${sortBy}`, query.sortOrder ?? SortOrder.ASC)
      .skip(skip)
      .take(query.limit);

    const [items, total] = await qb.getManyAndCount();

    return buildPaginatedResult(
      items.map((partner) => toPublicPartner(partner)),
      total,
      query,
    );
  }

  async findAll(
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<PartnerWithCounts>> {
    const skip = getPaginationSkip(query.page, query.limit);
    const sortBy = ALLOWED_SORT_FIELDS.includes(query.sortBy ?? '')
      ? query.sortBy!
      : 'createdAt';

    const qb = this.partnersRepository.createQueryBuilder('partner');

    if (query.search) {
      qb.andWhere(
        '(partner.firstName LIKE :search OR partner.lastName LIKE :search OR partner.email LIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    if (query.status) {
      qb.andWhere('partner.status = :status', { status: query.status });
    }

    qb.orderBy(`partner.${sortBy}`, query.sortOrder ?? SortOrder.DESC)
      .skip(skip)
      .take(query.limit);

    const [items, total] = await qb.getManyAndCount();
    const withCounts = await this.attachPartnerCounts(items);
    return buildPaginatedResult(withCounts, total, query);
  }

  async findOne(id: string): Promise<PartnerWithCounts> {
    const partner = await this.findOneEntity(id);
    const [withCounts] = await this.attachPartnerCounts([partner]);
    return withCounts;
  }

  async findOnePublic(id: string): Promise<PublicPartnerView> {
    const partner = await this.partnersRepository.findOne({
      where: { id, status: PartnerStatus.ACTIVE },
    });

    if (!partner) {
      throw new NotFoundException(`Partner ${id} not found`);
    }

    return toPublicPartner(partner);
  }

  async findOneEntity(id: string): Promise<Partner> {
    const partner = await this.partnersRepository.findOneBy({ id });

    if (!partner) {
      throw new NotFoundException(`Partner ${id} not found`);
    }

    return partner;
  }

  async update(id: string, updatePartnerDto: UpdatePartnerDto): Promise<Partner> {
    const partner = await this.findOneEntity(id);
    const previousLogoUrl = partner.logoUrl;
    const linkedUser = await this.userService.findPartnerLoginByPartnerId(id);
    // Prefer the login account that currently shares the partner email
    // (primary account). Team users also have the partner role.
    const primaryLogin =
      linkedUser &&
      linkedUser.email.toLowerCase() === partner.email.toLowerCase()
        ? linkedUser
        : ((await this.userService.findByEmail(partner.email)) ?? linkedUser);

    if (updatePartnerDto.email !== undefined) {
      const normalizedEmail = updatePartnerDto.email.trim().toLowerCase();

      if (normalizedEmail !== partner.email.toLowerCase()) {
        await this.assertPartnerEmailAvailable(normalizedEmail, id);
        // The partner's own login account legitimately shares this email, so
        // exclude it from the uniqueness check.
        await this.userService.assertEmailAvailable(
          normalizedEmail,
          primaryLogin?.id,
        );
        partner.email = normalizedEmail;

        // Keep the linked login account's email in sync so the partner can
        // still sign in after an email change.
        if (primaryLogin) {
          primaryLogin.email = normalizedEmail;
          await this.userService.save(primaryLogin);
        }
      }
    }

    const { email: _email, ...rest } = updatePartnerDto;
    Object.assign(partner, rest);

    this.assertCommissionValid(partner.commissionType, partner.commissionValue);

    const savedPartner = await this.partnersRepository.save(partner);

    if (
      updatePartnerDto.logoUrl !== undefined &&
      updatePartnerDto.logoUrl !== previousLogoUrl
    ) {
      await this.deletePartnerLogoFromS3(previousLogoUrl);
    }

    return savedPartner;
  }

  private async deletePartnerLogoFromS3(
    logoUrl: string | null | undefined,
  ): Promise<void> {
    if (!logoUrl) {
      return;
    }

    const key =
      this.s3Service.extractKeyFromUrl(logoUrl) ??
      (this.s3Service.isLikelyS3Key(logoUrl) ? logoUrl : null);

    if (key) {
      await this.s3Service.delete(key);
    }
  }

  async assertPartnerEmailAvailable(
    email: string,
    excludePartnerId?: string,
  ): Promise<void> {
    const existing = await this.partnersRepository
      .createQueryBuilder('partner')
      .where('LOWER(partner.email) = LOWER(:email)', { email: email.trim() })
      .getOne();

    if (existing && existing.id !== excludePartnerId) {
      throw new ConflictException('A partner with this email already exists');
    }
  }

  async updateFees(id: string, dto: UpdatePartnerFeesDto): Promise<Partner> {
    const partner = await this.findOneEntity(id);

    if (dto.onboardingFee !== undefined) {
      partner.onboardingFee = dto.onboardingFee;
    }

    if (dto.commissionType !== undefined) {
      partner.commissionType = dto.commissionType;
    }

    if (dto.commissionValue !== undefined) {
      partner.commissionValue = dto.commissionValue;
    }

    if (dto.onboardPercentage !== undefined) {
      partner.onboardPercentage = dto.onboardPercentage;
    }

    this.assertCommissionValid(partner.commissionType, partner.commissionValue);

    return this.partnersRepository.save(partner);
  }

  async disable(id: string): Promise<Partner> {
    const partner = await this.findOneEntity(id);
    const previousLogoUrl = partner.logoUrl;

    partner.status = PartnerStatus.DISABLED;
    partner.logoUrl = null;

    const savedPartner = await this.partnersRepository.save(partner);
    await this.deletePartnerLogoFromS3(previousLogoUrl);

    return savedPartner;
  }

  private async attachPartnerCounts(
    partners: Partner[],
  ): Promise<PartnerWithCounts[]> {
    if (partners.length === 0) {
      return [];
    }

    const ids = partners.map((partner) => partner.id);

    const studentRows = await this.dataSource
      .getRepository(User)
      .createQueryBuilder('user')
      .innerJoin('user.role', 'role')
      .select('user.partnerId', 'partnerId')
      .addSelect('COUNT(*)', 'cnt')
      .where('user.partnerId IN (:...ids)', { ids })
      .andWhere('role.name = :roleName', { roleName: RoleName.STUDENT })
      .groupBy('user.partnerId')
      .getRawMany<{ partnerId: string; cnt: string }>();

    const accessRows = await this.dataSource
      .getRepository(AccessCode)
      .createQueryBuilder('accessCode')
      .select('accessCode.partnerId', 'partnerId')
      .addSelect('COUNT(*)', 'cnt')
      .where('accessCode.partnerId IN (:...ids)', { ids })
      .groupBy('accessCode.partnerId')
      .getRawMany<{ partnerId: string; cnt: string }>();

    const studentMap = new Map(
      studentRows.map((row) => [row.partnerId, Number(row.cnt)]),
    );
    const accessMap = new Map(
      accessRows.map((row) => [row.partnerId, Number(row.cnt)]),
    );

    return partners.map((partner) => ({
      ...partner,
      studentCount: studentMap.get(partner.id) ?? 0,
      accessCodeCount: accessMap.get(partner.id) ?? 0,
    }));
  }
}
