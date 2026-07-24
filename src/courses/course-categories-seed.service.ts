import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import {
  CourseCategory,
  GENERAL_CATEGORY_SLUG,
} from './entities/course-category.entity';

const SEEDED_CATEGORIES: Array<{
  name: string;
  slug: string;
  isDefault?: boolean;
}> = [
  { name: 'General', slug: GENERAL_CATEGORY_SLUG, isDefault: true },
  {
    name: 'Microsoft Office Proficiency',
    slug: 'microsoft-office-proficiency',
  },
  {
    name: 'Online Collaboration with Google Workspace',
    slug: 'online-collaboration-google-workspace',
  },
  {
    name: 'Digital Content Creation for Educators',
    slug: 'digital-content-creation-for-educators',
  },
  {
    name: 'Using AI for Teachers and Students',
    slug: 'using-ai-for-teachers-and-students',
  },
];

@Injectable()
export class CourseCategoriesSeedService implements OnModuleInit {
  private readonly logger = new Logger(CourseCategoriesSeedService.name);

  constructor(
    @InjectRepository(CourseCategory)
    private readonly categoriesRepository: Repository<CourseCategory>,
  ) {}

  async onModuleInit(): Promise<void> {
    for (const item of SEEDED_CATEGORIES) {
      const existing = await this.categoriesRepository.findOne({
        where: { slug: item.slug },
      });
      if (existing) {
        let dirty = false;
        if (existing.name !== item.name) {
          existing.name = item.name;
          dirty = true;
        }
        if (Boolean(item.isDefault) !== existing.isDefault) {
          existing.isDefault = Boolean(item.isDefault);
          dirty = true;
        }
        if (dirty) {
          await this.categoriesRepository.save(existing);
        }
        continue;
      }

      await this.categoriesRepository.save(
        this.categoriesRepository.create({
          id: uuidv4(),
          name: item.name,
          slug: item.slug,
          iconUrl: null,
          isDefault: Boolean(item.isDefault),
        }),
      );
      this.logger.log(`Seeded course category: ${item.name}`);
    }
  }
}
