import type { QueryRunner } from 'typeorm';

import { StudentStatsEntity } from '../database/entities/student-stats.entity';
import type { RanksService } from '../gamification/ranks-service';
import {
  applyActivityCurrencyDelta,
  applyBadgeGrantDelta,
  applyBadgeRevokeDelta,
  ensureStudentStatsRow,
} from './student-stats-reward.helper';

describe('student-stats-reward.helper', () => {
  const ranksService = {
    calculateRankForPoints: jest.fn().mockResolvedValue(5),
  } as unknown as RanksService;

  const createQueryRunner = (stats: StudentStatsEntity | null): QueryRunner => {
    const manager = {
      findOne: jest.fn().mockResolvedValue(stats),
      create: jest.fn((_entity, payload) => payload),
      save: jest.fn(async (_entity, payload) => payload),
    };
    return { manager } as unknown as QueryRunner;
  };

  it('applyActivityCurrencyDelta updates currency and totalEarned', async () => {
    const stats = {
      enrollmentId: 1,
      currency: 10,
      totalEarned: 20,
      rankId: 1,
    } as StudentStatsEntity;
    const queryRunner = createQueryRunner(stats);
    await applyActivityCurrencyDelta(queryRunner, ranksService, 1, 7, 5);
    expect(stats.currency).toBe(15);
    expect(stats.totalEarned).toBe(25);
    expect(ranksService.calculateRankForPoints).toHaveBeenCalledWith(7, 25);
  });

  it('applyBadgeGrantDelta matches activity grant semantics', async () => {
    const stats = {
      enrollmentId: 2,
      currency: 0,
      totalEarned: 0,
      rankId: null,
    } as StudentStatsEntity;
    const queryRunner = createQueryRunner(stats);
    await applyBadgeGrantDelta(queryRunner, ranksService, 2, 3, 12);
    expect(stats.currency).toBe(12);
    expect(stats.totalEarned).toBe(12);
  });

  it('applyBadgeRevokeDelta reduces currency but not totalEarned', async () => {
    const stats = {
      enrollmentId: 3,
      currency: 30,
      totalEarned: 50,
      rankId: 2,
    } as StudentStatsEntity;
    const queryRunner = createQueryRunner(stats);
    await applyBadgeRevokeDelta(queryRunner, ranksService, 3, 4, 10);
    expect(stats.currency).toBe(20);
    expect(stats.totalEarned).toBe(50);
    expect(ranksService.calculateRankForPoints).toHaveBeenCalledWith(4, 50);
  });

  it('ensureStudentStatsRow creates a row when missing', async () => {
    const queryRunner = createQueryRunner(null);
    const row = await ensureStudentStatsRow(queryRunner, ranksService, 9, 1);
    expect(row.enrollmentId).toBe(9);
    expect(row.currency).toBe(0);
    expect(row.totalEarned).toBe(0);
  });
});
