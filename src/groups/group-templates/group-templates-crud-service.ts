import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { GroupTemplateFavoriteEntity } from '../../database/entities/group-template-favorite.entity';
import { GroupTemplateEntity } from '../../database/entities/group-template.entity';

export interface PaginatedGroupTemplates {
  items: GroupTemplateListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface GroupTemplateListItem {
  id: number;
  name: string;
  description: string | null;
  isPublic: boolean;
  creatorAccountId: number;
  baseGroupId: number | null;
  createdAt: string;
  isFavorite: boolean;
}

@Injectable()
export class GroupTemplatesCrudService {
  constructor(
    @InjectRepository(GroupTemplateEntity)
    private readonly templatesRepository: Repository<GroupTemplateEntity>,
    @InjectRepository(GroupTemplateFavoriteEntity)
    private readonly favoritesRepository: Repository<GroupTemplateFavoriteEntity>) {}

  async getTemplates(
    lecturerAccountId: number,
    scope: 'my' | 'public',
    limit: number,
    offset: number): Promise<PaginatedGroupTemplates> {
    const query = this.templatesRepository.createQueryBuilder('t')
      .select([
        't.id',
        't.name',
        't.description',
        't.isPublic',
        't.creatorAccountId',
        't.baseGroupId',
        't.createdAt',
      ]);

    if (scope === 'my') {
      query.where('t.creator_account_id = :accountId', { accountId: lecturerAccountId });
      query.orderBy('t.created_at', 'DESC');
    } else {
      query.where('t.is_public = true');
      query.leftJoin(
        GroupTemplateFavoriteEntity,
        'f',
        'f.template_id = t.id AND f.account_id = :accountId',
        { accountId: lecturerAccountId },
      );
      query.orderBy('CASE WHEN f.id IS NOT NULL THEN 0 ELSE 1 END', 'ASC');
      query.addOrderBy('t.created_at', 'DESC');
    }

    query.skip(offset).take(limit);

    const [entities, total] = await query.getManyAndCount();
    const favoriteIds = scope === 'public'
      ? await this.loadFavoriteTemplateIds(lecturerAccountId, entities.map((template) => template.id))
      : new Set<number>();

    const items = entities.map((template) => ({
      id: template.id,
      name: template.name,
      description: template.description,
      isPublic: template.isPublic,
      creatorAccountId: template.creatorAccountId,
      baseGroupId: template.baseGroupId,
      createdAt: template.createdAt.toISOString(),
      isFavorite: favoriteIds.has(template.id),
    }));

    return {
      items,
      total,
      limit,
      offset,
    };
  }

  async getTemplateDetails(
    templateId: number,
    lecturerAccountId: number): Promise<GroupTemplateEntity> {
    const template = await this.templatesRepository.findOne({ where: { id: templateId } });
    if (!template) {
      throw new NotFoundException(`Group template ${templateId} not found`);
    }

    if (!template.isPublic && template.creatorAccountId !== lecturerAccountId) {
      throw new ForbiddenException(`Cannot access private template ${templateId}`);
    }

    return template;
  }

  async setTemplateFavorite(
    templateId: number,
    lecturerAccountId: number,
    favorite: boolean): Promise<void> {
    const template = await this.templatesRepository.findOne({ where: { id: templateId } });
    if (!template) {
      throw new NotFoundException(`Group template ${templateId} not found`);
    }

    if (!template.isPublic) {
      throw new ForbiddenException('Favorites are only supported for public templates');
    }

    if (favorite) {
      const existing = await this.favoritesRepository.findOne({
        where: { accountId: lecturerAccountId, templateId },
      });
      if (!existing) {
        await this.favoritesRepository.save(
          this.favoritesRepository.create({ accountId: lecturerAccountId, templateId }),
        );
      }
      return;
    }

    await this.favoritesRepository.delete({ accountId: lecturerAccountId, templateId });
  }

  async updateTemplate(
    templateId: number,
    lecturerAccountId: number,
    updates: { name?: string; description?: string; isPublic?: boolean }): Promise<GroupTemplateEntity> {
    const template = await this.templatesRepository.findOne({ where: { id: templateId } });
    if (!template) {
      throw new NotFoundException(`Group template ${templateId} not found`);
    }

    if (template.creatorAccountId !== lecturerAccountId) {
      throw new ForbiddenException(`Only the creator can modify template ${templateId}`);
    }

    if (updates.name !== undefined) template.name = updates.name;
    if (updates.description !== undefined) template.description = updates.description;
    if (updates.isPublic !== undefined) template.isPublic = updates.isPublic;

    return this.templatesRepository.save(template);
  }

  async deleteTemplate(templateId: number, lecturerAccountId: number): Promise<void> {
    const template = await this.templatesRepository.findOne({ where: { id: templateId } });
    if (!template) {
      throw new NotFoundException(`Group template ${templateId} not found`);
    }

    if (template.creatorAccountId !== lecturerAccountId) {
      throw new ForbiddenException(`Only the creator can delete template ${templateId}`);
    }

    // Hard delete - does not affect groups created from it, and does not remove images.
    await this.templatesRepository.delete(templateId);
  }

  async cloneTemplate(
    templateId: number,
    lecturerAccountId: number,
    newName: string): Promise<GroupTemplateEntity> {
    const template = await this.templatesRepository.findOne({ where: { id: templateId } });
    if (!template) {
      throw new NotFoundException(`Group template ${templateId} not found`);
    }

    if (!template.isPublic && template.creatorAccountId !== lecturerAccountId) {
      throw new ForbiddenException(`Cannot clone private template ${templateId}`);
    }

    const clonedTemplate = this.templatesRepository.create({
      name: newName,
      description: template.description,
      isPublic: false,
      creatorAccountId: lecturerAccountId,
      baseGroupId: template.baseGroupId,
      data: template.data,
    });

    return this.templatesRepository.save(clonedTemplate);
  }

  private async loadFavoriteTemplateIds(
    lecturerAccountId: number,
    templateIds: number[]): Promise<Set<number>> {
    if (templateIds.length === 0) {
      return new Set();
    }

    const favorites = await this.favoritesRepository
      .createQueryBuilder('f')
      .select('f.templateId', 'templateId')
      .where('f.account_id = :accountId', { accountId: lecturerAccountId })
      .andWhere('f.template_id IN (:...templateIds)', { templateIds })
      .getRawMany<{ templateId: number }>();

    return new Set(favorites.map((row) => Number(row.templateId)));
  }
}
