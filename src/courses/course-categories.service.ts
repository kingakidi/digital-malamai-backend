import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResult } from '../common/interfaces/pagination.interface';
import { SortOrder } from '../common/types/sort-order.type';
import {
  buildPaginatedResult,
  getPaginationSkip,
} from '../common/utils/pagination.util';
import { generateUniqueSlug, slugify } from '../common/utils/slug.util';
import { CreateCourseCategoryDto } from './dto/create-course-category.dto';
import { UpdateCourseCategoryDto } from './dto/update-course-category.dto';
import {
  CourseCategory,
  GENERAL_CATEGORY_SLUG,
} from './entities/course-category.entity';
import { Course } from './entities/course.entity';

const CATEGORY_SORT_FIELDS = ['name', 'slug', 'createdAt', 'updatedAt'];

@Injectable()
export class CourseCategoriesService {
  constructor(
    @InjectRepository(CourseCategory)
    private readonly categoriesRepository: Repository<CourseCategory>,
    @InjectRepository(Course)
    private readonly coursesRepository: Repository<Course>,
  ) {}

  async getGeneralCategory(): Promise<CourseCategory> {
    const general = await this.categoriesRepository.findOne({
      where: { slug: GENERAL_CATEGORY_SLUG },
    });
    if (!general) {
      throw new NotFoundException('Default General category is missing');
    }
    return general;
  }

  async assertCategoryExists(id: string): Promise<CourseCategory> {
    const category = await this.categoriesRepository.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException(`Category ${id} not found`);
    }
    return category;
  }

  async listAll(): Promise<CourseCategory[]> {
    return this.categoriesRepository.find({
      order: { isDefault: 'DESC', name: 'ASC' },
    });
  }

  async listPublic(): Promise<CourseCategory[]> {
    return this.categoriesRepository.find({
      order: { isDefault: 'DESC', name: 'ASC' },
    });
  }

  async findBySlugOrId(slugOrId: string): Promise<CourseCategory | null> {
    const value = slugOrId.trim();
    if (!value) return null;

    const byId = await this.categoriesRepository.findOne({ where: { id: value } });
    if (byId) return byId;

    return this.categoriesRepository.findOne({ where: { slug: value } });
  }

  async findAll(
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<CourseCategory>> {
    const skip = getPaginationSkip(query.page, query.limit);
    const sortBy = CATEGORY_SORT_FIELDS.includes(query.sortBy ?? '')
      ? query.sortBy!
      : 'name';

    const qb = this.categoriesRepository
      .createQueryBuilder('category')
      .loadRelationCountAndMap('category.courseCount', 'category.courses');

    if (query.search) {
      qb.andWhere(
        '(category.name LIKE :search OR category.slug LIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy(`category.${sortBy}`, query.sortOrder ?? SortOrder.ASC)
      .addOrderBy('category.name', SortOrder.ASC)
      .skip(skip)
      .take(query.limit);

    const [items, total] = await qb.getManyAndCount();
    return buildPaginatedResult(items, total, query);
  }

  async findOne(id: string): Promise<CourseCategory> {
    const category = await this.categoriesRepository
      .createQueryBuilder('category')
      .loadRelationCountAndMap('category.courseCount', 'category.courses')
      .where('category.id = :id', { id })
      .getOne();

    if (!category) {
      throw new NotFoundException(`Category ${id} not found`);
    }

    return category;
  }

  async create(dto: CreateCourseCategoryDto): Promise<CourseCategory> {
    const slug = await this.resolveUniqueSlug(dto.slug ?? dto.name, dto.slug);

    const category = this.categoriesRepository.create({
      name: dto.name.trim(),
      slug,
      iconUrl: dto.iconUrl?.trim() || null,
      isDefault: false,
    });

    return this.categoriesRepository.save(category);
  }

  async update(
    id: string,
    dto: UpdateCourseCategoryDto,
  ): Promise<CourseCategory> {
    const category = await this.assertCategoryExists(id);

    if (dto.name !== undefined) {
      category.name = dto.name.trim();
    }

    if (dto.slug !== undefined) {
      const nextSlug = slugify(dto.slug);
      if (category.isDefault && nextSlug !== GENERAL_CATEGORY_SLUG) {
        throw new BadRequestException(
          'The General category slug cannot be changed',
        );
      }
      if (nextSlug !== category.slug) {
        category.slug = await this.resolveUniqueSlug(nextSlug, nextSlug, id);
      }
    }

    if (dto.iconUrl !== undefined) {
      category.iconUrl = dto.iconUrl?.trim() || null;
    }

    return this.categoriesRepository.save(category);
  }

  async remove(id: string): Promise<void> {
    const category = await this.assertCategoryExists(id);

    if (category.isDefault || category.slug === GENERAL_CATEGORY_SLUG) {
      throw new BadRequestException('The General category cannot be deleted');
    }

    const general = await this.getGeneralCategory();

    await this.coursesRepository
      .createQueryBuilder()
      .update(Course)
      .set({ categoryId: general.id })
      .where('categoryId = :categoryId', { categoryId: id })
      .execute();

    await this.categoriesRepository.remove(category);
  }

  private async resolveUniqueSlug(
    value: string,
    preferred?: string,
    excludeId?: string,
  ): Promise<string> {
    const base = preferred ? slugify(preferred) : slugify(value);
    return generateUniqueSlug(base, async (candidate) => {
      const existing = await this.categoriesRepository.findOne({
        where: { slug: candidate },
      });
      if (!existing) return false;
      return existing.id !== excludeId;
    });
  }
}
