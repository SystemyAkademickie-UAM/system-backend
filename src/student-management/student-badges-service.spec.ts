import { ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Request } from 'express';
import { DataSource } from 'typeorm';

import { SessionService } from '../auth/session/session.service';
import { BacklogService } from '../backlog/backlog-service';
import { ORGANIZATION_LOG_KIND_BADGE_REVOKED } from '../constants/organization-log-constants';
import { STUDENT_ROLE_NAME } from '../constants/role-name-constants';
import { BadgeEntity } from '../database/entities/badge.entity';
import { EarnedBadgeEntity } from '../database/entities/earned-badge.entity';
import { EnrollmentEntity } from '../database/entities/enrollment.entity';
import { RanksService } from '../gamification/ranks-service';
import { GroupAuthorizationService } from '../groups/group-authorization.service';
import { OrganizationLogService } from '../organization-log/organization-log.service';
import { UserRolesService } from '../user-roles/user-roles-service';
import { type StudentBadgeItem, StudentBadgesService } from './student-badges-service';
import * as rewardHelper from './student-stats-reward.helper';

const GROUP_ID = 7;
const VIEWER_ACCOUNT_ID = 100;
const VIEWER_ENROLLMENT_ID = 10;
const OTHER_ACCOUNT_ID = 200;
const OTHER_ENROLLMENT_ID = 20;
const SECRET_BADGE_ID = 2;
const DRAFT_SECRET_BADGE_ID = 3;

function buildBadge(overrides: Partial<BadgeEntity> = {}): BadgeEntity {
  return Object.assign(new BadgeEntity(), {
    id: 1,
    groupId: GROUP_ID,
    name: 'Pierwsze kroki',
    educationalDescription: 'Za pierwszy etap',
    icon: '🏅',
    storyDescription: null,
    rewardAmount: 10,
    rarity: 'common',
    isPublished: true,
    publishedAt: null,
    globalDiscountType: null,
    globalDiscountValue: 0,
    isSecret: false,
    ...overrides,
  });
}

describe('StudentBadgesService.getStudentBadges', () => {
  let service: StudentBadgesService;
  let sessionService: { resolveSubjectFromRequest: jest.Mock };
  let userRolesService: { findAccountIdForRole: jest.Mock; findAccountIdForRoleInOrganization: jest.Mock };
  let groupAuthorizationService: { isLecturerOwner: jest.Mock };
  let badgeRepository: { find: jest.Mock };
  let enrollmentRepository: { findOne: jest.Mock };
  let earnedBadgesByEnrollment: Map<number, number[]>;
  const mockRequest = {} as Request;
  const regularBadge = buildBadge({ id: 1 });
  const secretBadge = buildBadge({
    id: SECRET_BADGE_ID,
    name: 'Ukryty mistrz',
    icon: '🦉',
    rarity: 'epic',
    rewardAmount: 99,
    isSecret: true,
  });
  const draftSecretBadge = buildBadge({
    id: DRAFT_SECRET_BADGE_ID,
    name: 'Szkic sekretu',
    icon: '🔒',
    isSecret: true,
    isPublished: false,
  });

  beforeEach(async () => {
    earnedBadgesByEnrollment = new Map<number, number[]>([
      [VIEWER_ENROLLMENT_ID, []],
      [OTHER_ENROLLMENT_ID, [SECRET_BADGE_ID]],
    ]);
    sessionService = {
      resolveSubjectFromRequest: jest.fn().mockResolvedValue({ userId: 1, sessionId: 1, activeRole: null, organizationId: 3 }),
    };
    userRolesService = {
      findAccountIdForRole: jest.fn().mockResolvedValue(VIEWER_ACCOUNT_ID),
      findAccountIdForRoleInOrganization: jest.fn().mockResolvedValue(VIEWER_ACCOUNT_ID),
    };
    groupAuthorizationService = { isLecturerOwner: jest.fn().mockResolvedValue(false) };
    badgeRepository = {
      find: jest.fn(async ({ where }: { where: { isPublished?: boolean } }) =>
        where.isPublished === true ? [regularBadge, secretBadge] : [regularBadge, secretBadge, draftSecretBadge]),
    };
    enrollmentRepository = {
      findOne: jest.fn(async ({ where }: { where: { studentAccountId: number } }) => {
        if (where.studentAccountId === VIEWER_ACCOUNT_ID) {
          return { id: VIEWER_ENROLLMENT_ID, groupId: GROUP_ID, studentAccountId: VIEWER_ACCOUNT_ID };
        }
        if (where.studentAccountId === OTHER_ACCOUNT_ID) {
          return { id: OTHER_ENROLLMENT_ID, groupId: GROUP_ID, studentAccountId: OTHER_ACCOUNT_ID };
        }
        return null;
      }),
    };
    const earnedBadgeRepository = {
      find: jest.fn(async ({ where }: { where: { enrollmentId: number } }) =>
        (earnedBadgesByEnrollment.get(where.enrollmentId) ?? []).map((badgeId) => ({
          id: badgeId * 1000,
          enrollmentId: where.enrollmentId,
          badgeId,
        }))),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentBadgesService,
        { provide: SessionService, useValue: sessionService },
        { provide: UserRolesService, useValue: userRolesService },
        { provide: RanksService, useValue: {} },
        { provide: BacklogService, useValue: {} },
        { provide: DataSource, useValue: {} },
        { provide: getRepositoryToken(BadgeEntity), useValue: badgeRepository },
        { provide: getRepositoryToken(EarnedBadgeEntity), useValue: earnedBadgeRepository },
        { provide: getRepositoryToken(EnrollmentEntity), useValue: enrollmentRepository },
        { provide: GroupAuthorizationService, useValue: groupAuthorizationService },
      ],
    }).compile();
    service = module.get<StudentBadgesService>(StudentBadgesService);
  });

  function findSecretItem(badges: StudentBadgeItem[]): StudentBadgeItem | undefined {
    return badges.find((badge) => badge.id === SECRET_BADGE_ID);
  }

  it('rejects unauthenticated callers with 401 Unauthorized', async () => {
    sessionService.resolveSubjectFromRequest.mockResolvedValue(null);
    await expect(service.getStudentBadges(mockRequest, GROUP_ID, OTHER_ACCOUNT_ID)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a student who is not enrolled in the group with 403 Forbidden', async () => {
    userRolesService.findAccountIdForRoleInOrganization.mockResolvedValue(999);
    await expect(service.getStudentBadges(mockRequest, GROUP_ID, OTHER_ACCOUNT_ID)).rejects.toThrow(
      'Not authorized to access badges in this group');
  });

  it('throws NotFoundException when the target student is not enrolled in the group', async () => {
    groupAuthorizationService.isLecturerOwner.mockResolvedValue(true);
    await expect(service.getStudentBadges(mockRequest, GROUP_ID, 999)).rejects.toThrow(NotFoundException);
  });

  it('reveals all badges including unpublished drafts to the group owner', async () => {
    groupAuthorizationService.isLecturerOwner.mockResolvedValue(true);
    const actual = await service.getStudentBadges(mockRequest, GROUP_ID, VIEWER_ACCOUNT_ID);
    expect(badgeRepository.find).toHaveBeenCalledWith({ where: { groupId: GROUP_ID }, order: { id: 'ASC' } });
    expect(actual.badges.map((badge) => badge.id)).toEqual([1, SECRET_BADGE_ID, DRAFT_SECRET_BADGE_ID]);
    expect(findSecretItem(actual.badges)).toMatchObject({
      name: 'Ukryty mistrz',
      icon: '🦉',
      rewardAmount: 99,
      isSecret: true,
      isRevealed: true,
      isEarned: false,
    });
  });

  it('hides unpublished badges and masks an unearned secret badge in the student own list', async () => {
    const actual = await service.getStudentBadges(mockRequest, GROUP_ID, VIEWER_ACCOUNT_ID);
    expect(badgeRepository.find).toHaveBeenCalledWith({
      where: { groupId: GROUP_ID, isPublished: true },
      order: { id: 'ASC' },
    });
    expect(actual.badges.some((badge) => badge.id === DRAFT_SECRET_BADGE_ID)).toBe(false);
    expect(actual.badges.find((badge) => badge.id === 1)).toMatchObject({ name: 'Pierwsze kroki', isRevealed: true });
    expect(findSecretItem(actual.badges)).toEqual({
      id: SECRET_BADGE_ID,
      name: null,
      icon: null,
      rarity: 'epic',
      educationalDescription: null,
      storyDescription: null,
      rewardAmount: null,
      isSecret: true,
      isRevealed: false,
      isEarned: false,
    });
  });

  it('falls back to findAccountIdForRole when session has no organizationId', async () => {
    sessionService.resolveSubjectFromRequest.mockResolvedValue({ userId: 1, sessionId: 1, activeRole: null, organizationId: null });
    await service.getStudentBadges(mockRequest, GROUP_ID, VIEWER_ACCOUNT_ID);
    expect(userRolesService.findAccountIdForRole).toHaveBeenCalledWith(1, STUDENT_ROLE_NAME);
  });

  it('reveals a secret badge the student earned in their own list', async () => {
    earnedBadgesByEnrollment.set(VIEWER_ENROLLMENT_ID, [SECRET_BADGE_ID]);
    const actual = await service.getStudentBadges(mockRequest, GROUP_ID, VIEWER_ACCOUNT_ID);
    expect(findSecretItem(actual.badges)).toMatchObject({ name: 'Ukryty mistrz', isRevealed: true, isEarned: true });
  });

  it('shows that a teammate earned a secret badge with its rarity colour without revealing its details', async () => {
    const actual = await service.getStudentBadges(mockRequest, GROUP_ID, OTHER_ACCOUNT_ID);
    expect(findSecretItem(actual.badges)).toMatchObject({
      name: null,
      icon: null,
      rarity: 'epic',
      rewardAmount: null,
      isSecret: true,
      isRevealed: false,
      isEarned: true,
    });
  });

  it('reveals a teammate secret badge when the viewer earned it too', async () => {
    earnedBadgesByEnrollment.set(VIEWER_ENROLLMENT_ID, [SECRET_BADGE_ID]);
    const actual = await service.getStudentBadges(mockRequest, GROUP_ID, OTHER_ACCOUNT_ID);
    expect(findSecretItem(actual.badges)).toMatchObject({ name: 'Ukryty mistrz', isRevealed: true, isEarned: true });
  });
});

describe('StudentBadgesService.toggleBadge — secret badge notifications and transaction safety', () => {
  let service: StudentBadgesService;
  let backlogService: { logEvent: jest.Mock };
  let organizationLogService: { recordForGroup: jest.Mock };
  let groupAuthorizationService: { assertLecturerOwnsGroupFromRequest: jest.Mock };
  let badgeRepository: { findOne: jest.Mock };
  let mockQueryRunner: {
    connect: jest.Mock;
    startTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
    release: jest.Mock;
    manager: {
      findOne: jest.Mock;
      create: jest.Mock;
      save: jest.Mock;
      remove: jest.Mock;
    };
  };
  const mockRequest = {} as Request;

  beforeEach(async () => {
    jest.spyOn(rewardHelper, 'applyBadgeGrantDelta').mockResolvedValue({ previousRankId: null, newRankId: null });
    jest.spyOn(rewardHelper, 'applyBadgeRevokeDelta').mockResolvedValue(undefined);
    backlogService = { logEvent: jest.fn().mockResolvedValue({}) };
    organizationLogService = { recordForGroup: jest.fn().mockResolvedValue(undefined) };
    groupAuthorizationService = { assertLecturerOwnsGroupFromRequest: jest.fn().mockResolvedValue(1) };
    badgeRepository = { findOne: jest.fn() };
    mockQueryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn((_entity: unknown, payload: unknown) => payload),
        save: jest.fn().mockResolvedValue({}),
        remove: jest.fn().mockResolvedValue({}),
      },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentBadgesService,
        { provide: SessionService, useValue: {} },
        { provide: UserRolesService, useValue: {} },
        { provide: RanksService, useValue: {} },
        { provide: BacklogService, useValue: backlogService },
        { provide: OrganizationLogService, useValue: organizationLogService },
        { provide: DataSource, useValue: { createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner) } },
        { provide: getRepositoryToken(BadgeEntity), useValue: badgeRepository },
        { provide: getRepositoryToken(EarnedBadgeEntity), useValue: {} },
        {
          provide: getRepositoryToken(EnrollmentEntity),
          useValue: { findOne: jest.fn().mockResolvedValue({ id: VIEWER_ENROLLMENT_ID, groupId: GROUP_ID, studentAccountId: VIEWER_ACCOUNT_ID }) },
        },
        { provide: GroupAuthorizationService, useValue: groupAuthorizationService },
      ],
    }).compile();
    service = module.get<StudentBadgesService>(StudentBadgesService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('denies non-owners attempting to toggle a badge', async () => {
    groupAuthorizationService.assertLecturerOwnsGroupFromRequest.mockRejectedValue(new ForbiddenException('Forbidden'));
    await expect(service.toggleBadge(mockRequest, GROUP_ID, VIEWER_ACCOUNT_ID, SECRET_BADGE_ID)).rejects.toThrow(
      ForbiddenException);
    expect(mockQueryRunner.startTransaction).not.toHaveBeenCalled();
  });

  it('logs a revealed secret badge notification when granting a secret badge', async () => {
    badgeRepository.findOne.mockResolvedValue(
      buildBadge({ id: SECRET_BADGE_ID, name: 'Ukryty mistrz', rewardAmount: 42, isSecret: true }));
    const actual = await service.toggleBadge(mockRequest, GROUP_ID, VIEWER_ACCOUNT_ID, SECRET_BADGE_ID);
    expect(actual).toEqual({ isEarned: true });
    expect(backlogService.logEvent).toHaveBeenCalledWith(
      GROUP_ID,
      VIEWER_ACCOUNT_ID,
      'BADGE_EARNED',
      {
        message: 'Otrzymano sekretną odznakę: Ukryty mistrz.',
        badgeId: SECRET_BADGE_ID,
        badgeName: 'Ukryty mistrz',
        rewardAmount: 42,
        isSecret: true,
      },
      expect.anything());
  });

  it('logs the standard notification when granting a regular badge', async () => {
    badgeRepository.findOne.mockResolvedValue(buildBadge({ id: 1, name: 'Pierwsze kroki', rewardAmount: 10, isSecret: false }));
    const actual = await service.toggleBadge(mockRequest, GROUP_ID, VIEWER_ACCOUNT_ID, 1);
    expect(actual).toEqual({ isEarned: true });
    expect(backlogService.logEvent).toHaveBeenCalledWith(
      GROUP_ID,
      VIEWER_ACCOUNT_ID,
      'BADGE_EARNED',
      {
        message: 'Otrzymano odznakę: Pierwsze kroki.',
        badgeId: 1,
        badgeName: 'Pierwsze kroki',
        rewardAmount: 10,
      },
      expect.anything());
  });

  it('revokes an already earned secret badge and records an organization log entry', async () => {
    const existingEarned = { id: 500, enrollmentId: VIEWER_ENROLLMENT_ID, badgeId: SECRET_BADGE_ID };
    badgeRepository.findOne.mockResolvedValue(
      buildBadge({ id: SECRET_BADGE_ID, name: 'Ukryty mistrz', rewardAmount: 42, isSecret: true }));
    mockQueryRunner.manager.findOne.mockResolvedValue(existingEarned);
    const actual = await service.toggleBadge(mockRequest, GROUP_ID, VIEWER_ACCOUNT_ID, SECRET_BADGE_ID);
    expect(actual).toEqual({ isEarned: false });
    expect(mockQueryRunner.manager.remove).toHaveBeenCalledWith(EarnedBadgeEntity, existingEarned);
    expect(organizationLogService.recordForGroup).toHaveBeenCalledWith(
      expect.objectContaining({
        groupId: GROUP_ID,
        kind: ORGANIZATION_LOG_KIND_BADGE_REVOKED,
        actorAccountId: VIEWER_ACCOUNT_ID,
        detail: { badgeName: 'Ukryty mistrz' },
      }));
    expect(backlogService.logEvent).not.toHaveBeenCalled();
  });

  it('rolls back and releases the transaction when saving fails', async () => {
    badgeRepository.findOne.mockResolvedValue(buildBadge({ id: SECRET_BADGE_ID, isSecret: true }));
    mockQueryRunner.manager.save.mockRejectedValue(new Error('DB constraint failed'));
    await expect(service.toggleBadge(mockRequest, GROUP_ID, VIEWER_ACCOUNT_ID, SECRET_BADGE_ID)).rejects.toThrow(
      'DB constraint failed');
    expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(mockQueryRunner.release).toHaveBeenCalledTimes(1);
  });
});
