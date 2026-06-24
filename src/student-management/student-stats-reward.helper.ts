import type { QueryRunner } from 'typeorm';

import { StudentStatsEntity } from '../database/entities/student-stats.entity';
import type { RanksService } from '../gamification/ranks-service';

/**
 * Ensures a student_stats row exists for the enrollment inside a transaction.
 */
export async function ensureStudentStatsRow(
  queryRunner: QueryRunner,
  ranksService: RanksService,
  enrollmentId: number,
  groupId: number): Promise<StudentStatsEntity> {
  let stats = await queryRunner.manager.findOne(StudentStatsEntity, {
    where: { enrollmentId },
  });
  if (!stats) {
    const initialRankId = await ranksService.calculateRankForPoints(groupId, 0);
    stats = queryRunner.manager.create(StudentStatsEntity, {
      enrollmentId,
      currency: 0,
      totalEarned: 0,
      rankId: initialRankId,
    });
  }
  return stats;
}

/**
 * Activity completion grant/revoke: adjusts currency and totalEarned by the same delta.
 */
export async function applyActivityCurrencyDelta(
  queryRunner: QueryRunner,
  ranksService: RanksService,
  enrollmentId: number,
  groupId: number,
  delta: number): Promise<void> {
  if (delta === 0) {
    return;
  }
  const stats = await ensureStudentStatsRow(queryRunner, ranksService, enrollmentId, groupId);
  stats.currency = Math.max(0, (stats.currency ?? 0) + delta);
  stats.totalEarned = Math.max(0, (stats.totalEarned ?? 0) + delta);
  stats.rankId = await ranksService.calculateRankForPoints(groupId, stats.totalEarned);
  await queryRunner.manager.save(StudentStatsEntity, stats);
}

/**
 * Badge grant: currency and totalEarned increase by reward amount.
 */
export async function applyBadgeGrantDelta(
  queryRunner: QueryRunner,
  ranksService: RanksService,
  enrollmentId: number,
  groupId: number,
  rewardAmount: number): Promise<void> {
  await applyActivityCurrencyDelta(queryRunner, ranksService, enrollmentId, groupId, rewardAmount);
}

/**
 * Badge revoke: currency decreases (min 0); totalEarned is unchanged.
 */
export async function applyBadgeRevokeDelta(
  queryRunner: QueryRunner,
  ranksService: RanksService,
  enrollmentId: number,
  groupId: number,
  rewardAmount: number): Promise<void> {
  if (rewardAmount === 0) {
    return;
  }
  const stats = await ensureStudentStatsRow(queryRunner, ranksService, enrollmentId, groupId);
  stats.currency = Math.max(0, (stats.currency ?? 0) - rewardAmount);
  stats.rankId = await ranksService.calculateRankForPoints(groupId, stats.totalEarned ?? 0);
  await queryRunner.manager.save(StudentStatsEntity, stats);
}
