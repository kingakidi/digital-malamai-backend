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
import {
  ACCESS_CODE_BATCH_INSERT_SIZE,
  ACCESS_CODE_PREVIEW_LIMIT,
  MAX_ACCESS_CODES_PER_REQUEST,
} from './constants/access-codes.constants';
import { DeleteAccessCodesDto } from './dto/delete-access-codes.dto';
import { GenerateAccessCodesDto } from './dto/generate-access-codes.dto';
import { AccessCode } from './entities/access-code.entity';
import {
  AccessCodeStats,
  SerializedAccessCode,
} from './types/serialized-access-code.type';

const MAX_SINGLE_INSERT_ATTEMPTS = 10;
const ALLOWED_SORT_FIELDS = ['createdAt', 'code', 'isUsed', 'expiresAt'];

export interface GenerateAccessCodesResult {
  partnerId: string;
  requested: number;
  generated: number;
  codes?: SerializedAccessCode[];
}

export interface DeleteAccessCodesResult {
  deleted: number;
  skipped: number;
}

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
  ): Promise<GenerateAccessCodesResult> {
    await this.partnersService.findOneEntity(partnerId);

    const requested = Math.min(dto.count ?? 1, MAX_ACCESS_CODES_PER_REQUEST);

    if (requested <= ACCESS_CODE_PREVIEW_LIMIT) {
      return this.generateSmallBatch(partnerId, requested);
    }

    return this.generateLargeBatch(partnerId, requested);
  }

  async deleteForPartner(
    partnerId: string,
    dto: DeleteAccessCodesDto,
  ): Promise<DeleteAccessCodesResult> {
    await this.partnersService.findOneEntity(partnerId);

    if (dto.deleteAllUnused) {
      return this.deleteAllUnusedForPartner(partnerId);
    }

    if (!dto.ids?.length) {
      throw new BadRequestException(
        'Provide ids or set deleteAllUnused to true',
      );
    }

    return this.deleteUnusedByIds(partnerId, dto.ids);
  }

  async findForPartner(
    partnerId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<SerializedAccessCode>> {
    await this.partnersService.findOneEntity(partnerId);

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
    await this.partnersService.findOneEntity(partnerId);

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

  private async generateSmallBatch(
    partnerId: string,
    requested: number,
  ): Promise<GenerateAccessCodesResult> {
    const created: AccessCode[] = [];

    for (let i = 0; i < requested; i++) {
      created.push(await this.createUniqueCode(partnerId));
    }

    return {
      partnerId,
      requested,
      generated: created.length,
      codes: created.map((code) => this.serialize(code)),
    };
  }

  private async generateLargeBatch(
    partnerId: string,
    requested: number,
  ): Promise<GenerateAccessCodesResult> {
    let generated = 0;
    let stagnantRounds = 0;

    while (generated < requested) {
      const remaining = requested - generated;
      const batchSize = Math.min(ACCESS_CODE_BATCH_INSERT_SIZE, remaining);
      const inserted = await this.insertUniqueCodeBatch(partnerId, batchSize);

      if (inserted === 0) {
        stagnantRounds += 1;

        if (stagnantRounds >= MAX_SINGLE_INSERT_ATTEMPTS) {
          throw new BadRequestException(
            'Unable to generate enough unique access codes. Try a smaller count.',
          );
        }

        continue;
      }

      stagnantRounds = 0;
      generated += inserted;
    }

    return {
      partnerId,
      requested,
      generated,
    };
  }

  private async insertUniqueCodeBatch(
    partnerId: string,
    targetCount: number,
  ): Promise<number> {
    const candidates = new Set<string>();

    while (candidates.size < targetCount) {
      candidates.add(this.accessCodeGenerator.generateCode());
    }

    const values = [...candidates].map((code) => ({ partnerId, code }));

    const result = await this.accessCodesRepository
      .createQueryBuilder()
      .insert()
      .into(AccessCode)
      .values(values)
      .orIgnore()
      .execute();

    return this.getInsertAffectedRows(result);
  }

  private getInsertAffectedRows(result: {
    raw?: { affectedRows?: number };
    identifiers?: unknown[];
  }): number {
    if (typeof result.raw?.affectedRows === 'number') {
      return result.raw.affectedRows;
    }

    return result.identifiers?.length ?? 0;
  }

  private async deleteAllUnusedForPartner(
    partnerId: string,
  ): Promise<DeleteAccessCodesResult> {
    const totalUnused = await this.accessCodesRepository.count({
      where: { partnerId, isUsed: false },
    });

    const result = await this.buildUnusedDeleteQuery(partnerId).execute();

    return {
      deleted: result.affected ?? 0,
      skipped: Math.max(totalUnused - (result.affected ?? 0), 0),
    };
  }

  private async deleteUnusedByIds(
    partnerId: string,
    ids: string[],
  ): Promise<DeleteAccessCodesResult> {
    const result = await this.buildUnusedDeleteQuery(partnerId)
      .andWhere('id IN (:...ids)', { ids })
      .execute();

    const deleted = result.affected ?? 0;

    return {
      deleted,
      skipped: ids.length - deleted,
    };
  }

  private buildUnusedDeleteQuery(partnerId: string) {
    return this.accessCodesRepository
      .createQueryBuilder()
      .delete()
      .from(AccessCode)
      .where('partnerId = :partnerId', { partnerId })
      .andWhere('isUsed = :isUsed', { isUsed: false })
      .andWhere('studentId IS NULL')
      .andWhere(
        `id NOT IN (SELECT accessCodeId FROM users WHERE accessCodeId IS NOT NULL)`,
      );
  }

  private async createUniqueCode(partnerId: string): Promise<AccessCode> {
    for (let attempt = 0; attempt < MAX_SINGLE_INSERT_ATTEMPTS; attempt++) {
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
