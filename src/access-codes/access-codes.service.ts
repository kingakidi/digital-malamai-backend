import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
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
  SerializedAccessCodeDetail,
} from './types/serialized-access-code.type';

const MAX_SINGLE_INSERT_ATTEMPTS = 10;
const ALLOWED_SORT_FIELDS = [
  'createdAt',
  'code',
  'isUsed',
  'expiresAt',
  'exportedAt',
];

export interface GenerateAccessCodesResult {
  partnerId: string | null;
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

  async generate(dto: GenerateAccessCodesDto): Promise<GenerateAccessCodesResult> {
    return this.generateBatch(null, dto);
  }

  async generateForPartner(
    partnerId: string,
    dto: GenerateAccessCodesDto,
  ): Promise<GenerateAccessCodesResult> {
    await this.partnersService.findOneEntity(partnerId);
    return this.generateBatch(partnerId, dto);
  }

  async deleteUnused(dto: DeleteAccessCodesDto): Promise<DeleteAccessCodesResult> {
    if (dto.deleteAllUnused) {
      return this.deleteAllUnused();
    }

    if (!dto.ids?.length) {
      throw new BadRequestException(
        'Provide ids or set deleteAllUnused to true',
      );
    }

    return this.deleteUnusedByIds(dto.ids);
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

    return this.deleteUnusedByIds(dto.ids, partnerId);
  }

  async findAll(
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<SerializedAccessCode>> {
    const skip = getPaginationSkip(query.page, query.limit);
    const sortBy = ALLOWED_SORT_FIELDS.includes(query.sortBy ?? '')
      ? query.sortBy!
      : 'createdAt';

    const qb = this.accessCodesRepository
      .createQueryBuilder('accessCode')
      .leftJoinAndSelect('accessCode.student', 'student');

    if (query.search) {
      qb.andWhere('accessCode.code LIKE :search', {
        search: `%${query.search}%`,
      });
    }

    this.applyStatusFilter(qb, query.status);
    this.applyCreatedAtRange(qb, query.dateFrom, query.dateTo);

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

  async findForPartner(
    partnerId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<SerializedAccessCode>> {
    await this.partnersService.findOneEntity(partnerId);

    const skip = getPaginationSkip(query.page, query.limit);
    const sortBy = ALLOWED_SORT_FIELDS.includes(query.sortBy ?? '')
      ? query.sortBy!
      : 'createdAt';

    // Partners no longer own code inventories. Show codes used by their students.
    const qb = this.accessCodesRepository
      .createQueryBuilder('accessCode')
      .innerJoinAndSelect('accessCode.student', 'student')
      .where('accessCode.isUsed = :isUsed', { isUsed: true })
      .andWhere('student.partnerId = :partnerId', { partnerId });

    if (query.search) {
      qb.andWhere(
        '(accessCode.code LIKE :search OR student.firstName LIKE :search OR student.lastName LIKE :search OR student.email LIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    this.applyCreatedAtRange(qb, query.dateFrom, query.dateTo);

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

  async findOne(id: string): Promise<SerializedAccessCodeDetail> {
    const accessCode = await this.accessCodesRepository.findOne({
      where: { id },
      relations: ['student', 'partner'],
    });

    if (!accessCode) {
      throw new NotFoundException('Access code not found');
    }

    return this.serializeDetail(accessCode);
  }

  async findOneForPartner(
    partnerId: string,
    id: string,
  ): Promise<SerializedAccessCodeDetail> {
    const accessCode = await this.accessCodesRepository
      .createQueryBuilder('accessCode')
      .leftJoinAndSelect('accessCode.student', 'student')
      .leftJoinAndSelect('accessCode.partner', 'partner')
      .where('accessCode.id = :id', { id })
      .andWhere('accessCode.isUsed = :isUsed', { isUsed: true })
      .andWhere('student.partnerId = :partnerId', { partnerId })
      .getOne();

    if (!accessCode) {
      throw new NotFoundException('Access code not found');
    }

    return this.serializeDetail(accessCode);
  }

  async getStats(): Promise<AccessCodeStats> {
    const now = new Date();

    const [total, used, expired, exported, readyToExport] = await Promise.all([
      this.accessCodesRepository.count(),
      this.accessCodesRepository.count({ where: { isUsed: true } }),
      this.accessCodesRepository
        .createQueryBuilder('accessCode')
        .where('accessCode.isUsed = :isUsed', { isUsed: false })
        .andWhere('accessCode.expiresAt IS NOT NULL')
        .andWhere('accessCode.expiresAt < :now', { now })
        .getCount(),
      this.accessCodesRepository
        .createQueryBuilder('accessCode')
        .where('accessCode.exportedAt IS NOT NULL')
        .getCount(),
      this.accessCodesRepository
        .createQueryBuilder('accessCode')
        .where('accessCode.isUsed = :isUsed', { isUsed: false })
        .andWhere('accessCode.exportedAt IS NULL')
        .andWhere(
          '(accessCode.expiresAt IS NULL OR accessCode.expiresAt >= :now)',
          { now },
        )
        .getCount(),
    ]);

    return {
      total,
      used,
      unused: total - used,
      expired,
      exported,
      readyToExport,
    };
  }

  /**
   * Paginated browse of ready-to-export codes (createdAt ASC).
   * Separate from the normal list so export can use limit=100 without rate limits.
   */
  async findReadyCodesForExport(
    query: {
      page: number;
      limit: number;
      dateFrom?: string;
      dateTo?: string;
    },
  ): Promise<PaginatedResult<SerializedAccessCode>> {
    const skip = getPaginationSkip(query.page, query.limit);
    const now = new Date();

    const qb = this.accessCodesRepository
      .createQueryBuilder('accessCode')
      .leftJoinAndSelect('accessCode.student', 'student')
      .where('accessCode.isUsed = :isUsed', { isUsed: false })
      .andWhere('accessCode.exportedAt IS NULL')
      .andWhere(
        '(accessCode.expiresAt IS NULL OR accessCode.expiresAt >= :now)',
        { now },
      );

    this.applyCreatedAtRange(qb, query.dateFrom, query.dateTo);

    qb.orderBy('accessCode.createdAt', SortOrder.ASC)
      .addOrderBy('accessCode.id', SortOrder.ASC)
      .skip(skip)
      .take(query.limit);

    const [items, total] = await qb.getManyAndCount();

    return buildPaginatedResult(
      items.map((code) => this.serialize(code)),
      total,
      query,
    );
  }

  /**
   * Bulk-fetch unused, not-yet-exported codes (createdAt ASC) and mark them exported.
   */
  async listUnusedCodesForExport(input: {
    count: number;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<{ codes: string[] }> {
    const now = new Date();

    return this.accessCodesRepository.manager.transaction(async (manager) => {
      const qb = manager
        .createQueryBuilder(AccessCode, 'accessCode')
        .where('accessCode.isUsed = :isUsed', { isUsed: false })
        .andWhere('accessCode.exportedAt IS NULL')
        .andWhere(
          '(accessCode.expiresAt IS NULL OR accessCode.expiresAt >= :now)',
          { now },
        );

      this.applyCreatedAtRange(qb, input.dateFrom, input.dateTo);

      const rows = await qb
        .orderBy('accessCode.createdAt', SortOrder.ASC)
        .addOrderBy('accessCode.id', SortOrder.ASC)
        .take(input.count)
        .getMany();

      if (rows.length === 0) {
        return { codes: [] };
      }

      const exportedAt = new Date();
      await manager
        .createQueryBuilder()
        .update(AccessCode)
        .set({ exportedAt })
        .whereInIds(rows.map((row) => row.id))
        .andWhere('exportedAt IS NULL')
        .execute();

      return { codes: rows.map((row) => row.code) };
    });
  }

  /** Mark specific ready codes as exported (used after for-export paging). */
  async markCodesExported(codes: string[]): Promise<{ marked: number }> {
    if (codes.length === 0) {
      return { marked: 0 };
    }

    const unique = [...new Set(codes.map((code) => code.trim()).filter(Boolean))];
    if (unique.length === 0) {
      return { marked: 0 };
    }

    const result = await this.accessCodesRepository
      .createQueryBuilder()
      .update(AccessCode)
      .set({ exportedAt: new Date() })
      .where('code IN (:...codes)', { codes: unique })
      .andWhere('isUsed = :isUsed', { isUsed: false })
      .andWhere('exportedAt IS NULL')
      .execute();

    return { marked: result.affected ?? 0 };
  }

  async getStatsForPartner(partnerId: string): Promise<AccessCodeStats> {
    await this.partnersService.findOneEntity(partnerId);

    const used = await this.accessCodesRepository
      .createQueryBuilder('accessCode')
      .innerJoin('accessCode.student', 'student')
      .where('accessCode.isUsed = :isUsed', { isUsed: true })
      .andWhere('student.partnerId = :partnerId', { partnerId })
      .getCount();

    return {
      total: used,
      used,
      unused: 0,
      expired: 0,
      exported: 0,
      readyToExport: 0,
    };
  }

  private async generateBatch(
    partnerId: string | null,
    dto: GenerateAccessCodesDto,
  ): Promise<GenerateAccessCodesResult> {
    const requested = Math.min(dto.count ?? 1, MAX_ACCESS_CODES_PER_REQUEST);

    if (requested <= ACCESS_CODE_PREVIEW_LIMIT) {
      return this.generateSmallBatch(partnerId, requested);
    }

    return this.generateLargeBatch(partnerId, requested);
  }

  private async generateSmallBatch(
    partnerId: string | null,
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
    partnerId: string | null,
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
    partnerId: string | null,
    targetCount: number,
  ): Promise<number> {
    const candidates = new Set<string>();

    while (candidates.size < targetCount) {
      candidates.add(this.accessCodeGenerator.generateCode());
    }

    const candidateList = [...candidates];
    const existing = await this.accessCodesRepository
      .createQueryBuilder('accessCode')
      .select(['accessCode.code'])
      .where('accessCode.code IN (:...codes)', { codes: candidateList })
      .getMany();
    const existingCodes = new Set(existing.map((row) => row.code));
    const values = candidateList
      .filter((code) => !existingCodes.has(code))
      .map((code) => ({ partnerId, code }));

    if (values.length === 0) {
      return 0;
    }

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

  private async deleteAllUnused(): Promise<DeleteAccessCodesResult> {
    const totalUnused = await this.accessCodesRepository.count({
      where: { isUsed: false },
    });

    const result = await this.buildUnusedDeleteQuery().execute();

    return {
      deleted: result.affected ?? 0,
      skipped: Math.max(totalUnused - (result.affected ?? 0), 0),
    };
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
    ids: string[],
    partnerId?: string,
  ): Promise<DeleteAccessCodesResult> {
    const qb = this.buildUnusedDeleteQuery(partnerId).andWhere(
      'id IN (:...ids)',
      { ids },
    );
    const result = await qb.execute();
    const deleted = result.affected ?? 0;

    return {
      deleted,
      skipped: ids.length - deleted,
    };
  }

  private buildUnusedDeleteQuery(partnerId?: string) {
    const qb = this.accessCodesRepository
      .createQueryBuilder()
      .delete()
      .from(AccessCode)
      .where('isUsed = :isUsed', { isUsed: false })
      .andWhere('studentId IS NULL')
      .andWhere(
        `id NOT IN (SELECT accessCodeId FROM users WHERE accessCodeId IS NOT NULL)`,
      );

    if (partnerId) {
      qb.andWhere('partnerId = :partnerId', { partnerId });
    }

    return qb;
  }

  private async createUniqueCode(
    partnerId: string | null,
  ): Promise<AccessCode> {
    for (let attempt = 0; attempt < MAX_SINGLE_INSERT_ATTEMPTS; attempt++) {
      const code = this.accessCodeGenerator.generateCode();

      const existing = await this.accessCodesRepository.findOneBy({ code });

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

  private applyStatusFilter(
    qb: SelectQueryBuilder<AccessCode>,
    status?: string,
  ): void {
    if (!status) return;

    const now = new Date();

    if (status === 'used') {
      qb.andWhere('accessCode.isUsed = :isUsed', { isUsed: true });
      return;
    }

    if (status === 'expired') {
      qb.andWhere('accessCode.isUsed = :isUsed', { isUsed: false })
        .andWhere('accessCode.expiresAt IS NOT NULL')
        .andWhere('accessCode.expiresAt < :now', { now });
      return;
    }

    if (status === 'exported') {
      qb.andWhere('accessCode.exportedAt IS NOT NULL');
      return;
    }

    if (status === 'unexported') {
      qb.andWhere('accessCode.exportedAt IS NULL');
      return;
    }

    if (status === 'ready') {
      qb.andWhere('accessCode.isUsed = :isUsed', { isUsed: false })
        .andWhere('accessCode.exportedAt IS NULL')
        .andWhere(
          '(accessCode.expiresAt IS NULL OR accessCode.expiresAt >= :now)',
          { now },
        );
      return;
    }

    if (status === 'available') {
      qb.andWhere('accessCode.isUsed = :isUsed', { isUsed: false }).andWhere(
        '(accessCode.expiresAt IS NULL OR accessCode.expiresAt >= :now)',
        { now },
      );
    }
  }

  private applyCreatedAtRange(
    qb: SelectQueryBuilder<AccessCode>,
    dateFrom?: string,
    dateTo?: string,
  ): void {
    if (dateFrom) {
      qb.andWhere('accessCode.createdAt >= :dateFrom', { dateFrom });
    }
    if (dateTo) {
      qb.andWhere('accessCode.createdAt <= :dateTo', {
        dateTo: `${dateTo} 23:59:59`,
      });
    }
  }

  private serialize(accessCode: AccessCode): SerializedAccessCode {
    return {
      id: accessCode.id,
      code: accessCode.code,
      partnerId: accessCode.partnerId,
      isUsed: accessCode.isUsed,
      expiresAt: accessCode.expiresAt,
      exportedAt: accessCode.exportedAt,
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

  private serializeDetail(accessCode: AccessCode): SerializedAccessCodeDetail {
    const partner = accessCode.partner;

    return {
      ...this.serialize(accessCode),
      partner: partner
        ? {
            id: partner.id,
            firstName: partner.firstName,
            lastName: partner.lastName,
            logoUrl: partner.logoUrl ?? null,
          }
        : {
            id: '',
            firstName: 'System',
            lastName: '',
            logoUrl: null,
          },
    };
  }
}
