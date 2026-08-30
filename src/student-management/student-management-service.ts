import { ForbiddenException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { DataSource, Repository } from 'typeorm';

import { SessionService } from '../auth/session/session.service';
import { BacklogService } from '../backlog/backlog-service';
import { LECTURER_ROLE_NAME, STUDENT_ROLE_NAME } from '../constants/role-name-constants';
import { EnrollmentEntity } from '../database/entities/enrollment.entity';
import { GroupEntity } from '../database/entities/group.entity';
import { StudentStatsEntity } from '../database/entities/student-stats.entity';
import { UserRolesService } from '../user-roles/user-roles-service';
import { RanksService } from '../gamification/ranks-service';
import { GroupAuthorizationService } from '../groups/group-authorization.service';
import { BulkUpdateStudentsDto } from './dto/bulk-update-student.dto';
import { DEFAULT_STUDENT_LIVES } from '../constants/lives-constants';
import { BulkUpdateLivesDto } from './dto/bulk-update-lives.dto';

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
  autoRankEnabled: boolean;
  lives: number;
}

/**
 * Response shape for a single participant row (limited data for students).
 */
export interface ParticipantListItem {
  accountId: number;
  nickname: string;
  avatarUrl: string | null;
  name?: string;
  surname?: string;
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
    private readonly backlogService: BacklogService,
    private readonly dataSource: DataSource,
    @InjectRepository(EnrollmentEntity)
    private readonly enrollmentRepository: Repository<EnrollmentEntity>,
    @InjectRepository(StudentStatsEntity)
    private readonly studentStatsRepository: Repository<StudentStatsEntity>,
    @InjectRepository(GroupEntity)
    private readonly groupRepository: Repository<GroupEntity>,
    private readonly ranksService: RanksService,
    private readonly groupAuthorizationService: GroupAuthorizationService) {}

  /**
   * GET /groups/:groupId/students
   * Cross-schema JOIN via raw SQL for optimal performance.
   */
  async getStudents(req: Request, groupId: number): Promise<StudentListItem[]> {
    await this.assertLecturerOwnsGroup(req, groupId);
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
         COALESCE(ss.total_earned, 0) AS "totalEarned",
         COALESCE(ss.auto_rank_enabled, true) AS "autoRankEnabled",
         COALESCE(ss.lives, 3)        AS "lives"
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
   * GET /groups/:groupId/participants
   * Limited participants list accessible to enrolled students and lecturers.
   */
  async getParticipants(req: Request, groupId: number): Promise<ParticipantListItem[]> {
    const subject = await this.sessionService.resolveSubjectFromRequest(req);
    if (!subject) {
      throw new UnauthorizedException('Not authorized');
    }
    await this.assertGroupExists(groupId);

    let authorized = false;
    const lecturerAccountId = await this.userRolesService.findAccountIdForRole(subject.userId, LECTURER_ROLE_NAME);
    if (lecturerAccountId !== null) {
      authorized = await this.groupRepository.exist({ where: { id: groupId, teacherAccountId: lecturerAccountId } });
    }
    if (!authorized) {
      const studentAccountId = await this.userRolesService.findAccountIdForRole(subject.userId, STUDENT_ROLE_NAME);
      if (studentAccountId !== null) {
        authorized = await this.enrollmentRepository.exist({ where: { groupId, studentAccountId } });
      }
    }
    if (!authorized) {
      throw new ForbiddenException('Not authorized');
    }

    const rows = await this.dataSource.query<ParticipantListItem[]>(
      `SELECT
         a.id            AS "accountId",
         u.nickname      AS "nickname",
         av.image_url    AS "avatarUrl",
         u.name          AS "name",
         u.surname       AS "surname"
       FROM gamification.enrollments e
       JOIN auth.accounts a  ON a.id = e.student_account_id
       JOIN auth.users u     ON u.id = a.user_id
       LEFT JOIN auth.avatars av ON av.id = u.avatar_id
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
    await this.assertLecturerOwnsGroup(req, groupId);
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
            autoRankEnabled: true,
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

        if (item.autoRankEnabled !== undefined) {
          stats.autoRankEnabled = item.autoRankEnabled;
        }

        const manualRankAssignment =
          item.rankId !== undefined
          && (item.autoRankEnabled === false || item.autoRankEnabled === undefined);
        if (manualRankAssignment) {
          stats.rankId = item.rankId ?? null;
          stats.autoRankEnabled = false;
        } else if (stats.autoRankEnabled) {
          const newRankId = await this.ranksService.calculateRankForPoints(groupId, stats.totalEarned || 0);
          stats.rankId = newRankId;
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
    await this.assertLecturerOwnsGroup(req, groupId);

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

  /**
   * Increases student lives by 1.
   */
  async incrementLives(req: Request, groupId: number, accountId: number): Promise<{ lives: number }> {
    await this.assertLecturerOwnsGroup(req, groupId);
    await this.assertGroupExists(groupId);

    const enrollment = await this.enrollmentRepository.findOne({
      where: { groupId, studentAccountId: accountId },
    });
    if (!enrollment) {
      throw new NotFoundException(`Student with accountId ${accountId} is not enrolled in group ${groupId}`);
    }

    let stats = await this.studentStatsRepository.findOne({
      where: { enrollmentId: enrollment.id },
    });
    if (!stats) {
      stats = this.studentStatsRepository.create({
        enrollmentId: enrollment.id,
        currency: 0,
        totalEarned: 0,
        rankId: null,
        autoRankEnabled: true,
        lives: 3,
      });
    }

    const currentLives = stats.lives ?? 3;
    const newLives = currentLives + 1;
    stats.lives = newLives;
    await this.studentStatsRepository.save(stats);

    await this.backlogService.logEvent(groupId, accountId, 'LIVES_CHANGED', {
      message: `Prowadzący zwiększył liczbę Twoich szans (żyć) o 1. Aktualna liczba szans: ${newLives}.`,
      lives: newLives,
      delta: 1,
    });

    this.logger.log(`Student (account=${accountId}) lives incremented to ${newLives} in group ${groupId}`);
    return { lives: newLives };
  }

  /**
   * Decreases student lives by 1 (minimum 0).
   */
  async decrementLives(req: Request, groupId: number, accountId: number): Promise<{ lives: number }> {
    await this.assertLecturerOwnsGroup(req, groupId);
    await this.assertGroupExists(groupId);

    const enrollment = await this.enrollmentRepository.findOne({
      where: { groupId, studentAccountId: accountId },
    });
    if (!enrollment) {
      throw new NotFoundException(`Student with accountId ${accountId} is not enrolled in group ${groupId}`);
    }

    let stats = await this.studentStatsRepository.findOne({
      where: { enrollmentId: enrollment.id },
    });
    if (!stats) {
      stats = this.studentStatsRepository.create({
        enrollmentId: enrollment.id,
        currency: 0,
        totalEarned: 0,
        rankId: null,
        autoRankEnabled: true,
        lives: 3,
      });
    }

    const currentLives = stats.lives ?? 3;
    const newLives = Math.max(0, currentLives - 1);
    stats.lives = newLives;
    await this.studentStatsRepository.save(stats);

    await this.backlogService.logEvent(groupId, accountId, 'LIVES_CHANGED', {
      message: `Prowadzący zmniejszył liczbę Twoich szans (żyć) o 1. Aktualna liczba szans: ${newLives}.`,
      lives: newLives,
      delta: -1,
    });

    this.logger.log(`Student (account=${accountId}) lives decremented to ${newLives} in group ${groupId}`);
    return { lives: newLives };
  }

  /**
   * PATCH /groups/:groupId/students/lives/bulk-update
   * Updates lives for multiple students in a single transaction.
   * Each student's lives are clamped to [0, group.lives] (livesMax).
   *
   * @returns Updated students and account IDs skipped because they are not enrolled.
   */
  async bulkUpdateLives(
    req: Request,
    groupId: number,
    dto: BulkUpdateLivesDto,
  ): Promise<{ results: { accountId: number; lives: number }[]; skippedAccountIds: number[] }> {
    await this.assertLecturerOwnsGroup(req, groupId);

    const group = await this.groupRepository.findOne({ where: { id: groupId } });
    if (!group) {
      throw new NotFoundException(`Group with id ${groupId} not found`);
    }
    const livesMax = group.lives ?? null;
    const defaultLives = group.startingLives ?? group.lives ?? DEFAULT_STUDENT_LIVES;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const results: { accountId: number; lives: number }[] = [];
    const skippedAccountIds: number[] = [];

    try {
      for (const item of dto.students) {
        const enrollment = await queryRunner.manager.findOne(EnrollmentEntity, {
          where: { groupId, studentAccountId: item.accountId },
        });

        if (!enrollment) {
          this.logger.warn(
            `Bulk-lives-update skipped: account ${item.accountId} not enrolled in group ${groupId}`);
          skippedAccountIds.push(item.accountId);
          continue;
        }

        let stats = await queryRunner.manager.findOne(StudentStatsEntity, {
          where: { enrollmentId: enrollment.id },
        });

        if (!stats) {
          stats = queryRunner.manager.create(StudentStatsEntity, {
            enrollmentId: enrollment.id,
            currency: 0,
            totalEarned: 0,
            rankId: null,
            autoRankEnabled: true,
            lives: defaultLives,
          });
        }

        const currentLives = stats.lives ?? defaultLives;
        const uncapped = currentLives + item.delta;
        const newLives = livesMax != null
          ? Math.min(livesMax, Math.max(0, uncapped))
          : Math.max(0, uncapped);

        stats.lives = newLives;
        await queryRunner.manager.save(StudentStatsEntity, stats);

        await this.backlogService.logEvent(groupId, item.accountId, 'LIVES_CHANGED', {
          message: `Prowadzący zmienił liczbę Twoich szans (żyć) o ${item.delta > 0 ? '+' : ''}${item.delta}. Aktualna liczba szans: ${newLives}.`,
          lives: newLives,
          delta: item.delta,
        });

        results.push({ accountId: item.accountId, lives: newLives });
      }

      await queryRunner.commitTransaction();
      this.logger.log(
        `Bulk-lives-update: ${results.length} student(s) updated in group ${groupId}` +
        (skippedAccountIds.length > 0 ? `, skipped ${skippedAccountIds.length}` : ''));
      return { results, skippedAccountIds };
    } catch (err: unknown) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Bulk-lives-update failed for group ${groupId}: ${String(err)}`);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // ── Shared auth & validation helpers ────────────────────────────────

  private async assertLecturerOwnsGroup(req: Request, groupId: number): Promise<void> {
    await this.groupAuthorizationService.assertLecturerOwnsGroupFromRequest(req, groupId);
  }

  private async assertGroupExists(groupId: number): Promise<void> {
    const exists = await this.groupRepository.exist({ where: { id: groupId } });
    if (!exists) {
      throw new NotFoundException(`Group with id ${groupId} not found`);
    }
  }
}
