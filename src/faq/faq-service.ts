import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';

import { DEFAULT_FAQ_CATEGORY } from '../constants/faq-constants';
import { FaqEntity } from '../database/entities/faq.entity';
import { CreateFaqDto } from './dto/create-faq.dto';
import { ReorderFaqsDto } from './dto/reorder-faqs.dto';
import { ReplaceAllFaqsDto } from './dto/replace-all-faqs.dto';
import { UpdateFaqDto } from './dto/update-faq.dto';
import {
  FaqDeleteResponse,
  FaqGroupedCategoryResponse,
  FaqItemResponse,
  PublicFaqItemResponse,
} from './faq-response-types';

function mapFaqEntityToResponse(entity: FaqEntity): FaqItemResponse {
  return {
    id: entity.id,
    question: entity.question,
    answer: entity.answer,
    category: entity.category,
    orderIndex: entity.orderIndex,
    isPublished: entity.isPublished,
    createdByUserId: entity.createdByUserId,
    updatedByUserId: entity.updatedByUserId,
    createdAt:
      entity.createdAt instanceof Date
        ? entity.createdAt.toISOString()
        : new Date().toISOString(),
    updatedAt:
      entity.updatedAt instanceof Date
        ? entity.updatedAt.toISOString()
        : new Date().toISOString(),
  };
}

function mapFaqEntityToPublicResponse(
  entity: FaqEntity,
): PublicFaqItemResponse {
  const {
    createdByUserId: _createdByUserId,
    updatedByUserId: _updatedByUserId,
    ...publicView
  } = mapFaqEntityToResponse(entity);
  return publicView;
}

function applyUpdateDtoToEntity(
  entity: FaqEntity,
  dto: UpdateFaqDto,
  userId: number,
): void {
  if (dto.question !== undefined) {
    entity.question = dto.question;
  }
  if (dto.answer !== undefined) {
    entity.answer = dto.answer;
  }
  if (dto.category !== undefined) {
    entity.category = dto.category;
  }
  if (dto.orderIndex !== undefined) {
    entity.orderIndex = dto.orderIndex;
  }
  if (dto.isPublished !== undefined) {
    entity.isPublished = dto.isPublished;
  }
  entity.updatedByUserId = userId;
  entity.updatedAt = new Date();
}

/**
 * Service managing FAQ knowledge base CRUD operations, bulk page save, reordering, and category grouping.
 */
@Injectable()
export class FaqService {
  constructor(
    @InjectRepository(FaqEntity)
    private readonly faqRepository: Repository<FaqEntity>,
  ) {}

  /**
   * Lists all FAQ entries for super-administrators with optional category and search filters.
   */
  async listAdminFaqs(filters?: {
    category?: string;
    search?: string;
  }): Promise<FaqItemResponse[]> {
    const where: FindOptionsWhere<FaqEntity> = {};
    if (filters?.category) {
      where.category = filters.category;
    }
    if (filters?.search) {
      where.question = ILike(`%${filters.search}%`);
    }
    const entities = await this.faqRepository.find({
      where,
      order: { orderIndex: 'ASC', id: 'ASC' },
    });
    return entities.map(mapFaqEntityToResponse);
  }

  /**
   * Retrieves a single FAQ entry by its identifier, optionally restricting to published entries.
   */
  async getFaqById(
    id: number,
    options?: { publishedOnly?: boolean },
  ): Promise<FaqItemResponse> {
    const where: FindOptionsWhere<FaqEntity> = options?.publishedOnly
      ? { id, isPublished: true }
      : { id };
    const entity = await this.faqRepository.findOne({ where });
    if (!entity) {
      throw new NotFoundException(`FAQ entry #${id} not found`);
    }
    return mapFaqEntityToResponse(entity);
  }

  /**
   * Creates a new FAQ knowledge base entry.
   */
  async createFaq(dto: CreateFaqDto, userId: number): Promise<FaqItemResponse> {
    const entity = this.faqRepository.create({
      question: dto.question,
      answer: dto.answer,
      category: dto.category ?? DEFAULT_FAQ_CATEGORY,
      orderIndex: dto.orderIndex ?? 0,
      isPublished: dto.isPublished ?? true,
      createdByUserId: userId,
      updatedByUserId: userId,
    });
    const saved = await this.faqRepository.save(entity);
    return mapFaqEntityToResponse(saved);
  }

  /**
   * Updates an existing FAQ entry.
   */
  async updateFaq(
    id: number,
    dto: UpdateFaqDto,
    userId: number,
  ): Promise<FaqItemResponse> {
    const entity = await this.faqRepository.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`FAQ entry #${id} not found`);
    }
    applyUpdateDtoToEntity(entity, dto, userId);
    const updated = await this.faqRepository.save(entity);
    return mapFaqEntityToResponse(updated);
  }

  /**
   * Replaces the entire FAQ list atomically when the superadmin saves the edited FAQ page.
   */
  async replaceAllFaqs(
    dto: ReplaceAllFaqsDto,
    userId: number,
  ): Promise<FaqItemResponse[]> {
    return this.executeInTransaction((repo) =>
      this.performReplaceAll(repo, dto, userId),
    );
  }

  /**
   * Deletes an FAQ entry by its identifier.
   */
  async deleteFaq(id: number): Promise<FaqDeleteResponse> {
    const entity = await this.faqRepository.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`FAQ entry #${id} not found`);
    }
    await this.faqRepository.delete({ id });
    return { deleted: true, id };
  }

  /**
   * Batch updates ordering indices for multiple FAQ entries inside a transaction.
   */
  async reorderFaqs(
    dto: ReorderFaqsDto,
    userId: number,
  ): Promise<FaqItemResponse[]> {
    return this.executeInTransaction(async (repo) => {
      const now = new Date();
      for (const item of dto.items) {
        await repo.update(
          { id: item.id },
          { orderIndex: item.orderIndex, updatedByUserId: userId, updatedAt: now },
        );
      }
      const all = await repo.find({
        order: { orderIndex: 'ASC', id: 'ASC' },
      });
      return all.map(mapFaqEntityToResponse);
    });
  }

  /**
   * Retrieves a single published FAQ entry by its identifier without internal user IDs.
   */
  async getPublicFaqById(id: number): Promise<PublicFaqItemResponse> {
    const entity = await this.faqRepository.findOne({
      where: { id, isPublished: true },
    });
    if (!entity) {
      throw new NotFoundException(`FAQ entry #${id} not found`);
    }
    return mapFaqEntityToPublicResponse(entity);
  }

  /**
   * Lists published FAQ entries for regular application users without internal user IDs.
   */
  async listPublicFaqs(category?: string): Promise<PublicFaqItemResponse[]> {
    const where: FindOptionsWhere<FaqEntity> = { isPublished: true };
    if (category) {
      where.category = category;
    }
    const entities = await this.faqRepository.find({
      where,
      order: { orderIndex: 'ASC', id: 'ASC' },
    });
    return entities.map(mapFaqEntityToPublicResponse);
  }

  /**
   * Lists published FAQ entries grouped by category for accordion UI rendering.
   */
  async listGroupedPublicFaqs(): Promise<FaqGroupedCategoryResponse[]> {
    const items = await this.listPublicFaqs();
    const groupedMap = new Map<string, PublicFaqItemResponse[]>();
    for (const item of items) {
      const existing = groupedMap.get(item.category) ?? [];
      existing.push(item);
      groupedMap.set(item.category, existing);
    }
    return Array.from(groupedMap.entries()).map(([category, categoryItems]) => ({
      category,
      items: categoryItems,
    }));
  }

  private async executeInTransaction<T>(
    work: (repo: Repository<FaqEntity>) => Promise<T>,
  ): Promise<T> {
    if (this.faqRepository.manager?.transaction) {
      return this.faqRepository.manager.transaction((em) =>
        work(em.getRepository(FaqEntity)),
      );
    }
    return work(this.faqRepository);
  }

  private async performReplaceAll(
    repo: Repository<FaqEntity>,
    dto: ReplaceAllFaqsDto,
    userId: number,
  ): Promise<FaqItemResponse[]> {
    const existing = await repo.find();
    if (existing.length > 0) {
      await repo.delete(existing.map((row) => row.id));
    }
    if (dto.items.length === 0) {
      return [];
    }
    const toCreate = dto.items.map((item, idx) =>
      repo.create({
        question: item.question,
        answer: item.answer,
        category: item.category ?? DEFAULT_FAQ_CATEGORY,
        orderIndex: item.orderIndex ?? idx,
        isPublished: item.isPublished ?? true,
        createdByUserId: userId,
        updatedByUserId: userId,
      }),
    );
    const saved = await repo.save(toCreate);
    return saved.map(mapFaqEntityToResponse);
  }
}
