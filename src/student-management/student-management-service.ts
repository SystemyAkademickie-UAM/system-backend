import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { DataSource, Repository } from 'typeorm';

import { SessionService } from '../auth/session/session.service';
import { LECTURER_ROLE_NAME } from '../constants/role-name-constants';
import { EnrollmentEntity } from '../database/entities/enrollment.entity';
import { GroupEntity } from '../database/entities/group.entity';
import { StudentStatsEntity } from '../database/entities/student-stats.entity';
import { UserRolesService } from '../user-roles/user-roles-service';
import { RanksService } from '../gamification/ranks-service';
import { BulkUpdateStudentsDto } from './dto/bulk-update-student.dto';

/**
 * Response shape for a single student row in the participants table.
 */
export interface StudentListItem {
  enrollmentId: number;
  accountId: number;
  name: string;
  surname: string;
  nickname: string;
  email: string;
  avatarId: number;
  avatarUrl: string | null;
  rankId: number | null;
  currency: number;
  totalEarned: number;
}

/**
 * Part 1 – Students list, bulk update, and removal.
 */
@Injectable()
export class StudentManagementService {
  private readonly logger = new Logger(StudentManagementService.name);

  constructor(
    private readonly sessionService: SessionService,
    private readonly userRolesService: UserRolesService,
    private readonly dataSource: DataSource,
    @InjectRepository(EnrollmentEntity)
    private readonly enrollmentRepository: Repository<EnrollmentEntity>,
    @InjectRepository(StudentStatsEntity)
    private readonly studentStatsRepository: Repository<StudentStatsEntity>,
    @InjectRepository(GroupEntity)
    private readonly groupRepository: Repository<GroupEntity>,
    private readonly ranksService: RanksService) {}

  /**
   * GET /groups/:groupId/students
   * Cross-schema JOIN via raw SQL for optimal performance.
   */
  async getStudents(req: Request, groupId: number): Promise<StudentListItem[]> {
    await this.assertLecturer(req);
    await this.assertGroupExists(groupId);

    const rows = await this.dataSource.query<StudentListItem[]>(
      `SELECT
         e.id            AS "enrollmentId",
         a.id            AS "accountId",
         u.name          AS "name",
         u.surname       AS "surname",
         u.nickname      AS "nickname",
         u.email         AS "email",
         u.avatar_id     AS "avatarId",
         av.image_url    AS "avatarUrl",
         ss.rank_id      AS "rankId",
         COALESCE(ss.currency, 0)     AS "currency",
         COALESCE(ss.total_earned, 0) AS "totalEarned"
       FROM gamification.enrollments e
       JOIN auth.accounts a  ON a.id = e.student_account_id
       JOIN auth.users u     ON u.id = a.user_id
       LEFT JOIN auth.avatars av ON av.id = u.avatar_id
       LEFT JOIN gamification.student_stats ss ON ss.enrollment_id = e.id
       WHERE e.group_id = $1
       ORDER BY u.surname, u.name`,
      [groupId]);

    return rows;
  }

  /**
   * PATCH /groups/:groupId/students/bulk-update
   * Updates student_stats rows inside a transaction.
   */
  async bulkUpdate(req: Request, groupId: number, dto: BulkUpdateStudentsDto): Promise<{ updated: number }> {
    await this.assertLecturer(req);
    await this.assertGroupExists(groupId);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let updatedCount = 0;

      for (const item of dto.students) {
        // Verify the enrollment belongs to this group
        const enrollment = await queryRunner.manager.findOne(EnrollmentEntity, {
          where: { id: item.enrollmentId, groupId },
        });

        if (!enrollment) {
          this.logger.warn(
            `Bulk-update skipped: enrollment ${item.enrollmentId} not found in group ${groupId}`);
          continue;
        }

        // Upsert student_stats: ensure the row exists
        let stats = await queryRunner.manager.findOne(StudentStatsEntity, {
          where: { enrollmentId: item.enrollmentId },
        });

        if (!stats) {
          stats = queryRunner.manager.create(StudentStatsEntity, {
            enrollmentId: item.enrollmentId,
            currency: 0,
            totalEarned: 0,
            rankId: null,
          });
        }

        if (item.currency !== undefined) {
          const delta = item.currency - (stats.currency || 0);
          stats.currency = item.currency;
          if (delta > 0) {
            stats.totalEarned = (stats.totalEarned || 0) + delta;
          }
        }
        if (item.totalEarned !== undefined) {
          stats.totalEarned = item.totalEarned;
        }

        const newRankId = await this.ranksService.calculateRankForPoints(groupId, stats.totalEarned || 0);
        stats.rankId = newRankId;

        if (item.rankId !== undefined) {
          stats.rankId = item.rankId;
        }

        await queryRunner.manager.save(StudentStatsEntity, stats);
        updatedCount++;
      }

      await queryRunner.commitTransaction();
      this.logger.log(`Bulk-update: ${updatedCount} student(s) updated in group ${groupId}`);
      return { updated: updatedCount };
    } catch (err: unknown) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Bulk-update failed for group ${groupId}: ${String(err)}`);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * DELETE /groups/:groupId/students/:accountId
   * Transactional removal: earned_badges → student_stats → activity_backlog → enrollment.
   */
  async removeStudent(req: Request, groupId: number, accountId: number): Promise<{ removed: boolean }> {
    await this.assertLecturer(req);

    const enrollment = await this.enrollmentRepository.findOne({
      where: { groupId, studentAccountId: accountId },
    });

    if (!enrollment) {
      throw new NotFoundException(
        `Student with accountId ${accountId} is not enrolled in group ${groupId}`);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.query(
        `DELETE FROM gamification.earned_badges WHERE enrollment_id = $1`,
        [enrollment.id]);
      await queryRunner.query(
        `DELETE FROM gamification.student_stats WHERE enrollment_id = $1`,
        [enrollment.id]);
      await queryRunner.query(
        `DELETE FROM analytics.activity_backlog WHERE group_id = $1 AND account_id = $2`,
        [groupId, accountId]);
      await queryRunner.query(
        `DELETE FROM gamification.enrollments WHERE id = $1`,
        [enrollment.id]);

      await queryRunner.commitTransaction();
      this.logger.log(`Student (account=${accountId}) removed from group ${groupId}`);
      return { removed: true };
    } catch (err: unknown) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Remove student failed (group=${groupId}, account=${accountId}): ${String(err)}`);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // ── Shared auth & validation helpers ────────────────────────────────

  private async assertLecturer(req: Request): Promise<void> {
    const subject = await this.sessionService.resolveSubjectFromRequest(req);
    if (!subject) {
      throw new ForbiddenException('Not authorized');
    }
    const isLecturer = await this.userRolesService.userHasRole(subject.userId, LECTURER_ROLE_NAME);
    if (!isLecturer) {
      throw new ForbiddenException('Not authorized');
    }
  }

  private async assertGroupExists(groupId: number): Promise<void> {
    const exists = await this.groupRepository.exist({ where: { id: groupId } });
    if (!exists) {
      throw new NotFoundException(`Group with id ${groupId} not found`);
    }
  }
}
