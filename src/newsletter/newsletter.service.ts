import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResult } from '../common/interfaces/pagination.interface';
import { SortOrder } from '../common/types/sort-order.type';
import {
  buildPaginatedResult,
  getPaginationSkip,
} from '../common/utils/pagination.util';
import { SubscribeNewsletterDto } from './dto/subscribe-newsletter.dto';
import { NewsletterSubscriber } from './entities/newsletter-subscriber.entity';

const ALLOWED_SORT_FIELDS = ['createdAt', 'email', 'isActive'];

@Injectable()
export class NewsletterService {
  constructor(
    @InjectRepository(NewsletterSubscriber)
    private readonly subscribersRepository: Repository<NewsletterSubscriber>,
  ) {}

  async subscribe(dto: SubscribeNewsletterDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.subscribersRepository.findOne({
      where: { email },
    });

    if (existing) {
      if (existing.isActive) {
        throw new ConflictException('This email is already subscribed');
      }

      existing.isActive = true;
      const restored = await this.subscribersRepository.save(existing);
      return this.serialize(restored);
    }

    const subscriber = this.subscribersRepository.create({
      email,
      isActive: true,
    });
    const saved = await this.subscribersRepository.save(subscriber);
    return this.serialize(saved);
  }

  async findAll(
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<ReturnType<NewsletterService['serialize']>>> {
    const skip = getPaginationSkip(query.page, query.limit);
    const sortBy = ALLOWED_SORT_FIELDS.includes(query.sortBy ?? '')
      ? query.sortBy!
      : 'createdAt';

    const qb = this.subscribersRepository.createQueryBuilder('subscriber');

    if (query.search) {
      qb.andWhere('subscriber.email LIKE :search', {
        search: `%${query.search}%`,
      });
    }

    qb.orderBy(
      `subscriber.${sortBy}`,
      query.sortOrder ?? SortOrder.DESC,
    )
      .skip(skip)
      .take(query.limit);

    const [items, total] = await qb.getManyAndCount();

    return buildPaginatedResult(
      items.map((item) => this.serialize(item)),
      total,
      query,
    );
  }

  async remove(id: string): Promise<void> {
    const subscriber = await this.subscribersRepository.findOne({
      where: { id },
    });

    if (!subscriber) {
      throw new NotFoundException('Newsletter subscriber not found');
    }

    await this.subscribersRepository.remove(subscriber);
  }

  private serialize(subscriber: NewsletterSubscriber) {
    return {
      id: subscriber.id,
      email: subscriber.email,
      isActive: subscriber.isActive,
      createdAt: subscriber.createdAt,
      updatedAt: subscriber.updatedAt,
    };
  }
}
