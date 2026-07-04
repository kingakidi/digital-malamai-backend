import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResult } from '../common/interfaces/pagination.interface';
import { SortOrder } from '../common/types/sort-order.type';
import {
  buildPaginatedResult,
  getPaginationSkip,
} from '../common/utils/pagination.util';
import { PartnersService } from '../partners/partners.service';
import { AccessCodeGeneratorService } from './access-code-generator.service';
import { GenerateAccessCodesDto } from './dto/generate-access-codes.dto';
import { AccessCode } from './entities/access-code.entity';
import {
  AccessCodeStats,
  SerializedAccessCode,
} from './types/serialized-access-code.type';

const MAX_GENERATION_ATTEMPTS = 10;
const ALLOWED_SORT_FIELDS = ['createdAt', 'code', 'isUsed', 'expiresAt'];

@Injectable()
export class AccessCodesService {
  constructor(
    @InjectRepository(AccessCode)
    private readonly accessCodesRepository: Repository<AccessCode>,
    private readonly partnersService: PartnersService,
    private readonly accessCodeGenerator: AccessCodeGeneratorService,
  ) {}

  async generateForPartner(
    partnerId: string,
    dto: GenerateAccessCodesDto,
  ): Promise<SerializedAccessCode[]> {
    await this.partnersService.findOneEntity(partnerId);

    const count = dto.count ?? 1;
    const created: AccessCode[] = [];

    for (let i = 0; i < count; i++) {
      created.push(await this.createUniqueCode(partnerId));
    }

    return created.map((code) => this.serialize(code));
  }

  async findForPartner(
    partnerId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<SerializedAccessCode>> {
    const skip = getPaginationSkip(query.page, query.limit);
    const sortBy = ALLOWED_SORT_FIELDS.includes(query.sortBy ?? '')
      ? query.sortBy!
      : 'createdAt';

    const qb = this.accessCodesRepository
      .createQueryBuilder('accessCode')
      .leftJoinAndSelect('accessCode.student', 'student')
      .where('accessCode.partnerId = :partnerId', { partnerId });

    if (query.search) {
      qb.andWhere('accessCode.code LIKE :search', {
        search: `%${query.search}%`,
      });
    }

    qb.orderBy(`accessCode.${sortBy}`, query.sortOrder ?? SortOrder.DESC)
      .skip(skip)
      .take(query.limit);

    const [items, total] = await qb.getManyAndCount();

    return buildPaginatedResult(
      items.map((code) => this.serialize(code)),
      total,
      query,
    );
  }

  async getStatsForPartner(partnerId: string): Promise<AccessCodeStats> {
    const now = new Date();

    const [total, used, expired] = await Promise.all([
      this.accessCodesRepository.count({ where: { partnerId } }),
      this.accessCodesRepository.count({ where: { partnerId, isUsed: true } }),
      this.accessCodesRepository
        .createQueryBuilder('accessCode')
        .where('accessCode.partnerId = :partnerId', { partnerId })
        .andWhere('accessCode.isUsed = :isUsed', { isUsed: false })
        .andWhere('accessCode.expiresAt IS NOT NULL')
        .andWhere('accessCode.expiresAt < :now', { now })
        .getCount(),
    ]);

    return {
      total,
      used,
      unused: total - used,
      expired,
    };
  }

  private async createUniqueCode(partnerId: string): Promise<AccessCode> {
    for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
      const code = this.accessCodeGenerator.generateCode();

      const existing = await this.accessCodesRepository.findOneBy({
        partnerId,
        code,
      });

      if (!existing) {
        const accessCode = this.accessCodesRepository.create({
          partnerId,
          code,
        });

        return this.accessCodesRepository.save(accessCode);
      }
    }

    throw new BadRequestException(
      'Unable to generate a unique access code. Try again.',
    );
  }

  private serialize(accessCode: AccessCode): SerializedAccessCode {
    return {
      id: accessCode.id,
      code: accessCode.code,
      isUsed: accessCode.isUsed,
      expiresAt: accessCode.expiresAt,
      createdAt: accessCode.createdAt,
      student: accessCode.student
        ? {
            id: accessCode.student.id,
            firstName: accessCode.student.firstName,
            lastName: accessCode.student.lastName,
            email: accessCode.student.email,
          }
        : null,
    };
  }
}
