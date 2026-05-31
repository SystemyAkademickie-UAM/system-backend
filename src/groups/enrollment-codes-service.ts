import crypto from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { Repository } from 'typeorm';

import { AuthTokenSessionService } from '../auth/api-token/auth-token-session-service';
import {
  ENROLLMENT_CODE_GENERATED_BYTE_LENGTH,
} from '../constants/enrollment-code-constants';
import { LECTURER_ROLE_NAME } from '../constants/role-name-constants';
import { EnrollmentCodeEntity } from '../database/entities/enrollment-code.entity';
import { GroupEntity } from '../database/entities/group.entity';
import { UserRolesService } from '../user-roles/user-roles-service';
import { CreateEnrollmentCodeDto } from './dto/create-enrollment-code.dto';
import { UpdateEnrollmentCodeDto } from './dto/update-enrollment-code.dto';

/** Max RNG retries when an auto-generated code collides within the same group (not a lecturer quota). */
const ENROLLMENT_CODE_COLLISION_RETRIES = 32;

export type EnrollmentCodeValidationFailure =
  | 'not_found'
  | 'inactive'
  | 'expired'
  | 'max_uses_reached';

export type EnrollmentCodeValidationResult =
  | { ok: true; code: EnrollmentCodeEntity }
  | { ok: false; reason: EnrollmentCodeValidationFailure };

/**
 * CRUD and validation for `education.enrollment_codes`.
 */
@Injectable()
export class EnrollmentCodesService {
  private readonly logger = new Logger(EnrollmentCodesService.name);

  constructor(
    private readonly authTokenSessionService: AuthTokenSessionService,
    private readonly userRolesService: UserRolesService,
    @InjectRepository(EnrollmentCodeEntity)
    private readonly enrollmentCodeRepository: Repository<EnrollmentCodeEntity>,
    @InjectRepository(GroupEntity)
    private readonly groupRepository: Repository<GroupEntity>,
  ) {}

  async listCodesForGroup(req: Request, groupId: number, queryAuth?: string): Promise<EnrollmentCodeEntity[]> {
    await this.assertLecturerOwnsGroup(req, groupId, queryAuth);
    return this.enrollmentCodeRepository.find({
      where: { groupId },
      order: { id: 'DESC' },
    });
  }

  async getCodeForGroup(req: Request, groupId: number, codeId: number, queryAuth?: string): Promise<EnrollmentCodeEntity> {
    await this.assertLecturerOwnsGroup(req, groupId, queryAuth);
    const row = await this.enrollmentCodeRepository.findOne({ where: { id: codeId, groupId } });
    if (row === null) {
      throw new NotFoundException(`Enrollment code ${codeId} not found for group ${groupId}`);
    }
    return row;
  }

  async createCode(req: Request, groupId: number, dto: CreateEnrollmentCodeDto): Promise<EnrollmentCodeEntity> {
    await this.assertLecturerOwnsGroup(req, groupId, dto.auth);
    const code = dto.code?.trim().toUpperCase() ?? (await this.generateUniqueCode(groupId));
    if (code.length === 0) {
      throw new ForbiddenException('Could not generate a unique enrollment code');
    }
    if (dto.code !== undefined && dto.code.trim() !== '') {
      const exists = await this.enrollmentCodeRepository.exist({ where: { groupId, code } });
      if (exists) {
        throw new ConflictException(`Enrollment code "${code}" already exists for this group`);
      }
    }
    const entity = this.enrollmentCodeRepository.create({
      groupId,
      code,
      expiresAt: this.parseOptionalExpiresAt(dto.expiresAt),
      maxUses: dto.maxUses ?? null,
      useCount: 0,
      isActive: true,
    });
    const saved = await this.enrollmentCodeRepository.save(entity);
    this.logger.log(`Enrollment code id=${saved.id} created for group ${groupId}`);
    return saved;
  }

  async updateCode(
    req: Request,
    groupId: number,
    codeId: number,
    dto: UpdateEnrollmentCodeDto,
  ): Promise<EnrollmentCodeEntity> {
    await this.assertLecturerOwnsGroup(req, groupId, dto.auth);
    const entity = await this.enrollmentCodeRepository.findOne({ where: { id: codeId, groupId } });
    if (entity === null) {
      throw new NotFoundException(`Enrollment code ${codeId} not found for group ${groupId}`);
    }
    if (dto.expiresAt !== undefined) {
      entity.expiresAt = dto.expiresAt === null ? null : this.parseOptionalExpiresAt(dto.expiresAt);
    }
    if (dto.maxUses !== undefined) {
      entity.maxUses = dto.maxUses;
    }
    if (dto.isActive !== undefined) {
      entity.isActive = dto.isActive;
    }
    return this.enrollmentCodeRepository.save(entity);
  }

  async deleteCode(req: Request, groupId: number, codeId: number, queryAuth?: string): Promise<void> {
    await this.assertLecturerOwnsGroup(req, groupId, queryAuth);
    const result = await this.enrollmentCodeRepository.delete({ id: codeId, groupId });
    if (result.affected === 0) {
      throw new NotFoundException(`Enrollment code ${codeId} not found for group ${groupId}`);
    }
  }

  validateCodeEntity(code: EnrollmentCodeEntity): EnrollmentCodeValidationResult {
    if (!code.isActive) {
      return { ok: false, reason: 'inactive' };
    }
    if (code.expiresAt !== null && code.expiresAt <= new Date()) {
      return { ok: false, reason: 'expired' };
    }
    if (code.maxUses !== null && code.useCount >= code.maxUses) {
      return { ok: false, reason: 'max_uses_reached' };
    }
    return { ok: true, code };
  }

  async validateCodeForGroup(groupId: number, rawCode: string): Promise<EnrollmentCodeValidationResult> {
    const normalized = rawCode.trim().toUpperCase();
    if (normalized.length === 0) {
      return { ok: false, reason: 'not_found' };
    }
    const row = await this.enrollmentCodeRepository.findOne({ where: { groupId, code: normalized } });
    if (row === null) {
      return { ok: false, reason: 'not_found' };
    }
    return this.validateCodeEntity(row);
  }

  /**
   * Atomically increments use_count when limits allow.
   * @returns true when incremented, false when max uses already reached.
   */
  async tryIncrementUseCount(codeId: number): Promise<boolean> {
    const result = await this.enrollmentCodeRepository
      .createQueryBuilder()
      .update(EnrollmentCodeEntity)
      .set({ useCount: () => 'use_count + 1' })
      .where('id = :codeId', { codeId })
      .andWhere('is_active = true')
      .andWhere('(expires_at IS NULL OR expires_at > NOW())')
      .andWhere('(max_uses IS NULL OR use_count < max_uses)')
      .execute();
    return (result.affected ?? 0) > 0;
  }

  async findLatestActiveCode(groupId: number): Promise<EnrollmentCodeEntity | null> {
    const rows = await this.enrollmentCodeRepository.find({
      where: { groupId, isActive: true },
      order: { id: 'DESC' },
      take: 10,
    });
    for (const row of rows) {
      const validation = this.validateCodeEntity(row);
      if (validation.ok) {
        return row;
      }
    }
    return null;
  }

  private async assertLecturerOwnsGroup(req: Request, groupId: number, queryAuth?: string): Promise<void> {
    const subject = await this.authTokenSessionService.resolveSubjectSoftFromRequest(req, queryAuth);
    if (subject === null) {
      throw new ForbiddenException('Not authorized');
    }
    const isLecturer = await this.userRolesService.userHasRole(subject.userId, LECTURER_ROLE_NAME);
    if (!isLecturer) {
      throw new ForbiddenException('Not authorized');
    }
    const lecturerAccountId = await this.userRolesService.findAccountIdForRole(subject.userId, LECTURER_ROLE_NAME);
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

  private parseOptionalExpiresAt(value: string | undefined): Date | null {
    if (value === undefined || value.trim() === '') {
      return null;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('expiresAt must be a valid ISO-8601 timestamp');
    }
    return parsed;
  }

  private async generateUniqueCode(groupId: number): Promise<string> {
    for (let attempt = 0; attempt < ENROLLMENT_CODE_COLLISION_RETRIES; attempt += 1) {
      const code = crypto.randomBytes(ENROLLMENT_CODE_GENERATED_BYTE_LENGTH).toString('hex').toUpperCase();
      const exists = await this.enrollmentCodeRepository.exist({ where: { groupId, code } });
      if (!exists) {
        return code;
      }
    }
    return '';
  }
}
