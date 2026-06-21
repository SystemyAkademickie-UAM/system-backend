import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

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
}

@Injectable()
export class GroupTemplatesCrudService {
  constructor(
    @InjectRepository(GroupTemplateEntity)
    private readonly templatesRepository: Repository<GroupTemplateEntity>,
  ) {}

  async getTemplates(
    lecturerAccountId: number,
    scope: 'my' | 'public',
    limit: number,
    offset: number,
  ): Promise<PaginatedGroupTemplates> {
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
    } else {
      query.where('t.is_public = true');
    }

    query.orderBy('t.created_at', 'DESC');
    query.skip(offset).take(limit);

    const [entities, total] = await query.getManyAndCount();

    const items = entities.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      isPublic: t.isPublic,
      creatorAccountId: t.creatorAccountId,
      baseGroupId: t.baseGroupId,
      createdAt: t.createdAt.toISOString(),
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
    lecturerAccountId: number,
  ): Promise<GroupTemplateEntity> {
    const template = await this.templatesRepository.findOne({ where: { id: templateId } });
    if (!template) {
      throw new NotFoundException(`Group template ${templateId} not found`);
    }

    if (!template.isPublic && template.creatorAccountId !== lecturerAccountId) {
      throw new ForbiddenException(`Cannot access private template ${templateId}`);
    }

    return template;
  }

  async updateTemplate(
    templateId: number,
    lecturerAccountId: number,
    updates: { name?: string; description?: string; isPublic?: boolean },
  ): Promise<GroupTemplateEntity> {
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
    newName: string,
  ): Promise<GroupTemplateEntity> {
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
}
