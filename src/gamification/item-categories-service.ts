import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { QueryFailedError, Repository } from 'typeorm';

import { SessionService, type SessionSubject } from '../auth/session/session.service';
import { LECTURER_ROLE_NAME, STUDENT_ROLE_NAME } from '../constants/role-name-constants';
import { EnrollmentEntity } from '../database/entities/enrollment.entity';
import { GroupEntity } from '../database/entities/group.entity';
import { ItemCategoryEntity } from '../database/entities/item-category.entity';
import { UserRolesService } from '../user-roles/user-roles-service';
import { CreateItemCategoryDto } from './dto/create-item-category.dto';
import { UpdateItemCategoryDto } from './dto/update-item-category.dto';

const POSTGRES_UNIQUE_VIOLATION_CODE = '23505';

/**
 * Persists shop item categories in `gamification.item_categories` for a course group.
 */
@Injectable()
export class ItemCategoriesService {
  private readonly logger = new Logger(ItemCategoriesService.name);

  constructor(
    private readonly sessionService: SessionService,
    private readonly userRolesService: UserRolesService,
    @InjectRepository(ItemCategoryEntity)
    private readonly itemCategoryRepository: Repository<ItemCategoryEntity>,
    @InjectRepository(GroupEntity)
    private readonly groupRepository: Repository<GroupEntity>,
    @InjectRepository(EnrollmentEntity)
    private readonly enrollmentRepository: Repository<EnrollmentEntity>) {}

  async getCategoriesForGroup(
    req: Request,
    groupId: number,
    queryAuth?: string): Promise<ItemCategoryEntity[]> {
    await this.assertCanReadGroupShop(req, groupId, queryAuth);
    return this.itemCategoryRepository.find({
      where: { groupId },
      order: { displayOrder: 'ASC', name: 'ASC', id: 'ASC' },
    });
  }

  async createCategory(
    req: Request,
    groupId: number,
    dto: CreateItemCategoryDto): Promise<ItemCategoryEntity> {
    await this.assertLecturerOwnsGroup(req, groupId, dto.auth);
    const entity = this.itemCategoryRepository.create({
      groupId,
      name: dto.name.trim(),
      description: dto.description ?? null,
      displayOrder: dto.displayOrder ?? null,
      color: dto.color ?? null,
    });
    try {
      const saved = await this.itemCategoryRepository.save(entity);
      this.logger.log(`Item category "${saved.name}" (id=${saved.id}) created for group ${groupId}`);
      return saved;
    } catch (err: unknown) {
      this.rethrowUniqueCategoryNameConflict(err, groupId, dto.name);
      throw err;
    }
  }

  async updateCategory(
    req: Request,
    groupId: number,
    categoryId: number,
    dto: UpdateItemCategoryDto): Promise<ItemCategoryEntity> {
    await this.assertLecturerOwnsGroup(req, groupId, dto.auth);
    const category = await this.itemCategoryRepository.findOne({ where: { id: categoryId, groupId } });
    if (!category) {
      throw new NotFoundException(`Item category with id ${categoryId} not found in group ${groupId}`);
    }
    if (dto.name !== undefined) {
      category.name = dto.name.trim();
    }
    if (dto.description !== undefined) {
      category.description = dto.description;
    }
    if (dto.displayOrder !== undefined) {
      category.displayOrder = dto.displayOrder;
    }
    if (dto.color !== undefined) {
      category.color = dto.color;
    }
    try {
      const saved = await this.itemCategoryRepository.save(category);
      this.logger.log(`Item category "${saved.name}" (id=${saved.id}) updated in group ${groupId}`);
      return saved;
    } catch (err: unknown) {
      if (dto.name !== undefined) {
        this.rethrowUniqueCategoryNameConflict(err, groupId, dto.name);
      }
      throw err;
    }
  }

  async deleteCategory(
    req: Request,
    groupId: number,
    categoryId: number,
    bodyAuth?: string): Promise<{ deleted: boolean }> {
    await this.assertLecturerOwnsGroup(req, groupId, bodyAuth);
    const category = await this.itemCategoryRepository.findOne({ where: { id: categoryId, groupId } });
    if (!category) {
      throw new NotFoundException(`Item category with id ${categoryId} not found in group ${groupId}`);
    }
    await this.itemCategoryRepository.remove(category);
    this.logger.log(`Item category (id=${categoryId}) deleted from group ${groupId}`);
    return { deleted: true };
  }

  private async resolveSubject(req: Request, queryAuth?: string): Promise<SessionSubject> {
    const subject = await this.sessionService.resolveSubjectFromRequest(req, queryAuth);
    if (!subject) {
      throw new ForbiddenException('Not authorized');
    }
    return subject;
  }

  private async assertGroupExists(groupId: number): Promise<void> {
    const exists = await this.groupRepository.exist({ where: { id: groupId } });
    if (!exists) {
      throw new NotFoundException(`Group with id ${groupId} not found`);
    }
  }

  private async assertLecturerOwnsGroup(req: Request, groupId: number, queryAuth?: string): Promise<void> {
    const subject = await this.resolveSubject(req, queryAuth);
    const isLecturer = await this.userRolesService.userHasRole(subject.userId, LECTURER_ROLE_NAME);
    if (!isLecturer) {
      throw new ForbiddenException('Not authorized');
    }
    const lecturerAccountId = await this.userRolesService.findAccountIdForRole(
      subject.userId,
      LECTURER_ROLE_NAME);
    if (lecturerAccountId === null) {
      throw new ForbiddenException('Not authorized');
    }
    const group = await this.groupRepository.findOne({
      where: { id: groupId },
      select: ['id', 'teacherAccountId'],
    });
    if (group === null || group.teacherAccountId !== lecturerAccountId) {
      throw new ForbiddenException('Not authorized');
    }
  }

  private async assertCanReadGroupShop(req: Request, groupId: number, queryAuth?: string): Promise<void> {
    const subject = await this.resolveSubject(req, queryAuth);
    await this.assertGroupExists(groupId);
    const group = await this.groupRepository.findOne({
      where: { id: groupId },
      select: ['id', 'teacherAccountId'],
    });
    if (group === null) {
      throw new NotFoundException(`Group with id ${groupId} not found`);
    }
    const lecturerAccountId = await this.userRolesService.findAccountIdForRole(
      subject.userId,
      LECTURER_ROLE_NAME);
    if (lecturerAccountId !== null && group.teacherAccountId === lecturerAccountId) {
      return;
    }
    const studentAccountId = await this.userRolesService.findAccountIdForRole(
      subject.userId,
      STUDENT_ROLE_NAME);
    if (studentAccountId === null) {
      throw new ForbiddenException('Not authorized');
    }
    const isEnrolled = await this.enrollmentRepository.exist({
      where: { groupId, studentAccountId },
    });
    if (!isEnrolled) {
      throw new ForbiddenException('Not authorized');
    }
  }

  private rethrowUniqueCategoryNameConflict(err: unknown, groupId: number, name: string): void {
    if (!(err instanceof QueryFailedError)) {
      return;
    }
    const driverError = err.driverError as { code?: string };
    if (driverError.code !== POSTGRES_UNIQUE_VIOLATION_CODE) {
      return;
    }
    throw new ConflictException(`Category "${name}" already exists in group ${groupId}`);
  }
}
