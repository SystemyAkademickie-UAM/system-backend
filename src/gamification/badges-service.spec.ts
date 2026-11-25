import { ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Request } from 'express';
import { DataSource } from 'typeorm';

import { SessionService } from '../auth/session/session.service';
import { BacklogService } from '../backlog/backlog-service';
import { STUDENT_ROLE_NAME } from '../constants/role-name-constants';
import { BadgeEntity } from '../database/entities/badge.entity';
import { EarnedBadgeEntity } from '../database/entities/earned-badge.entity';
import { EnrollmentEntity } from '../database/entities/enrollment.entity';
import { GroupEntity } from '../database/entities/group.entity';
import { GroupAuthorizationService } from '../groups/group-authorization.service';
import { UserRolesService } from '../user-roles/user-roles-service';
import { BadgesService } from './badges-service';
import { RanksService } from './ranks-service';

const GROUP_ID = 7;
const ORGANIZATION_ID = 3;
const STUDENT_ACCOUNT_ID = 100;
const ENROLLMENT_ID = 55;

function buildBadge(overrides: Partial<BadgeEntity> = {}): BadgeEntity {
  return Object.assign(new BadgeEntity(), {
    id: 1,
    groupId: GROUP_ID,
    name: 'Pierwsze kroki',
    educationalDescription: 'Za pierwszy etap',
    icon: '🏅',
    storyDescription: 'Bohater rusza w drogę',
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

describe('BadgesService', () => {
  let service: BadgesService;
  let sessionService: { resolveSubjectFromRequest: jest.Mock };
  let userRolesService: { findAccountIdForRole: jest.Mock; findAccountIdForRoleInOrganization: jest.Mock };
  let groupAuthorizationService: { isLecturerOwner: jest.Mock; assertLecturerOwnsGroupFromRequest: jest.Mock };
  let backlogService: { notifyEnrolledStudents: jest.Mock };
  let badgeRepository: { find: jest.Mock; findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let earnedBadgeRepository: { find: jest.Mock };
  let groupRepository: { exist: jest.Mock };
  let enrollmentRepository: { findOne: jest.Mock };
  const mockRequest = {} as Request;
  const regularBadge = buildBadge({ id: 1 });
  const secretEarnedBadge = buildBadge({ id: 2, name: 'Nocny marek', isSecret: true });
  const secretLockedBadge = buildBadge({
    id: 3,
    name: 'Ukryty mistrz',
    isSecret: true,
    rewardAmount: 99,
    globalDiscountType: 'percent',
    globalDiscountValue: 15,
  });

  beforeEach(async () => {
    sessionService = {
      resolveSubjectFromRequest: jest.fn().mockResolvedValue({
        userId: 1,
        sessionId: 1,
        activeRole: null,
        organizationId: ORGANIZATION_ID,
      }),
    };
    userRolesService = {
      findAccountIdForRole: jest.fn().mockResolvedValue(STUDENT_ACCOUNT_ID),
      findAccountIdForRoleInOrganization: jest.fn().mockResolvedValue(STUDENT_ACCOUNT_ID),
    };
    groupAuthorizationService = {
      isLecturerOwner: jest.fn().mockResolvedValue(false),
      assertLecturerOwnsGroupFromRequest: jest.fn().mockResolvedValue(1),
    };
    backlogService = { notifyEnrolledStudents: jest.fn().mockResolvedValue(undefined) };
    badgeRepository = {
      find: jest.fn().mockResolvedValue([regularBadge, secretEarnedBadge, secretLockedBadge]),
      findOne: jest.fn(),
      create: jest.fn((data: Partial<BadgeEntity>) => buildBadge(data)),
      save: jest.fn(async (badge: BadgeEntity) => badge),
    };
    earnedBadgeRepository = {
      find: jest.fn().mockResolvedValue([{ id: 900, enrollmentId: ENROLLMENT_ID, badgeId: 2 }]),
    };
    groupRepository = { exist: jest.fn().mockResolvedValue(true) };
    enrollmentRepository = {
      findOne: jest.fn().mockResolvedValue({ id: ENROLLMENT_ID, groupId: GROUP_ID, studentAccountId: STUDENT_ACCOUNT_ID }),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BadgesService,
        { provide: SessionService, useValue: sessionService },
        { provide: UserRolesService, useValue: userRolesService },
        { provide: RanksService, useValue: {} },
        { provide: BacklogService, useValue: backlogService },
        { provide: DataSource, useValue: {} },
        { provide: getRepositoryToken(BadgeEntity), useValue: badgeRepository },
        { provide: getRepositoryToken(EarnedBadgeEntity), useValue: earnedBadgeRepository },
        { provide: getRepositoryToken(GroupEntity), useValue: groupRepository },
        { provide: getRepositoryToken(EnrollmentEntity), useValue: enrollmentRepository },
        { provide: GroupAuthorizationService, useValue: groupAuthorizationService },
      ],
    }).compile();
    service = module.get<BadgesService>(BadgesService);
  });

  describe('getBadgesForGroup', () => {
    it('rejects unauthenticated callers with 401 Unauthorized', async () => {
      sessionService.resolveSubjectFromRequest.mockResolvedValue(null);
      await expect(service.getBadgesForGroup(mockRequest, GROUP_ID)).rejects.toThrow(UnauthorizedException);
    });

    it('throws NotFoundException when the group does not exist', async () => {
      groupRepository.exist.mockResolvedValue(false);
      await expect(service.getBadgesForGroup(mockRequest, GROUP_ID)).rejects.toThrow(NotFoundException);
    });

    it('returns every badge with full details to the group owner', async () => {
      groupAuthorizationService.isLecturerOwner.mockResolvedValue(true);
      const actual = await service.getBadgesForGroup(mockRequest, GROUP_ID);
      expect(groupAuthorizationService.isLecturerOwner).toHaveBeenCalledWith(1, GROUP_ID, ORGANIZATION_ID);
      expect(badgeRepository.find).toHaveBeenCalledWith({ where: { groupId: GROUP_ID }, order: { id: 'ASC' } });
      expect(actual.map((badge) => badge.name)).toEqual(['Pierwsze kroki', 'Nocny marek', 'Ukryty mistrz']);
      expect(actual.every((badge) => badge.isRevealed)).toBe(true);
      expect(earnedBadgeRepository.find).not.toHaveBeenCalled();
    });

    it('shows published badges to an enrolled student and masks unearned secret badge details except rarity', async () => {
      const actual = await service.getBadgesForGroup(mockRequest, GROUP_ID);
      expect(badgeRepository.find).toHaveBeenCalledWith({
        where: { groupId: GROUP_ID, isPublished: true },
        order: { id: 'ASC' },
      });
      expect(userRolesService.findAccountIdForRoleInOrganization).toHaveBeenCalledWith(1, ORGANIZATION_ID, STUDENT_ROLE_NAME);
      expect(earnedBadgeRepository.find).toHaveBeenCalledWith({ where: { enrollmentId: ENROLLMENT_ID } });
      const [actualRegular, actualEarnedSecret, actualLockedSecret] = actual;
      expect(actualRegular).toMatchObject({ id: 1, name: 'Pierwsze kroki', isSecret: false, isRevealed: true });
      expect(actualEarnedSecret).toMatchObject({ id: 2, name: 'Nocny marek', isSecret: true, isRevealed: true });
      expect(actualLockedSecret).toMatchObject({
        id: 3,
        name: null,
        icon: null,
        educationalDescription: null,
        storyDescription: null,
        rewardAmount: null,
        rarity: 'common',
        globalDiscountType: null,
        globalDiscountValue: null,
        isSecret: true,
        isRevealed: false,
      });
    });

    it('falls back to findAccountIdForRole when session has no organizationId', async () => {
      sessionService.resolveSubjectFromRequest.mockResolvedValue({
        userId: 1,
        sessionId: 1,
        activeRole: null,
        organizationId: null,
      });
      await service.getBadgesForGroup(mockRequest, GROUP_ID);
      expect(userRolesService.findAccountIdForRole).toHaveBeenCalledWith(1, STUDENT_ROLE_NAME);
    });

    it('skips querying earned badges when the group has no published secret badges', async () => {
      badgeRepository.find.mockResolvedValue([regularBadge]);
      const actual = await service.getBadgesForGroup(mockRequest, GROUP_ID);
      expect(earnedBadgeRepository.find).not.toHaveBeenCalled();
      expect(actual).toEqual([expect.objectContaining({ id: 1, name: 'Pierwsze kroki', isRevealed: true })]);
    });

    it('rejects a non-owner caller without a student account with 403 Forbidden', async () => {
      userRolesService.findAccountIdForRoleInOrganization.mockResolvedValue(null);
      await expect(service.getBadgesForGroup(mockRequest, GROUP_ID)).rejects.toThrow(ForbiddenException);
      expect(enrollmentRepository.findOne).not.toHaveBeenCalled();
    });

    it('rejects a student not enrolled in the group with 403 Forbidden', async () => {
      enrollmentRepository.findOne.mockResolvedValue(null);
      await expect(service.getBadgesForGroup(mockRequest, GROUP_ID)).rejects.toThrow(ForbiddenException);
      expect(earnedBadgeRepository.find).not.toHaveBeenCalled();
    });
  });

  describe('createBadge', () => {
    it('denies non-owners and does not save or notify', async () => {
      groupAuthorizationService.assertLecturerOwnsGroupFromRequest.mockRejectedValue(new ForbiddenException('Forbidden'));
      await expect(service.createBadge(mockRequest, GROUP_ID, { name: 'Ukryty mistrz', icon: '🦉', isSecret: true })).rejects.toThrow(
        ForbiddenException);
      expect(badgeRepository.save).not.toHaveBeenCalled();
      expect(backlogService.notifyEnrolledStudents).not.toHaveBeenCalled();
    });

    it('stores a secret draft without notifying students before publication', async () => {
      const inputDto = { name: 'Ukryty mistrz', icon: '🦉', isSecret: true };
      const actual = await service.createBadge(mockRequest, GROUP_ID, inputDto);
      expect(badgeRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ isSecret: true, isPublished: false, publishedAt: null }));
      expect(actual).toMatchObject({ isSecret: true, isPublished: false });
      expect(backlogService.notifyEnrolledStudents).not.toHaveBeenCalled();
    });

    it('notifies students without revealing the name when creating a published secret badge', async () => {
      const inputDto = { name: 'Ukryty mistrz', icon: '🦉', isSecret: true, isPublished: true };
      const actual = await service.createBadge(mockRequest, GROUP_ID, inputDto);
      expect(actual).toMatchObject({ isSecret: true, isPublished: true });
      const [, , actualPayload] = backlogService.notifyEnrolledStudents.mock.calls[0];
      expect(actualPayload).toEqual({ message: 'Dodano nową sekretną odznakę.', badgeId: actual.id, isSecret: true });
      expect(JSON.stringify(actualPayload)).not.toContain('Ukryty mistrz');
    });

    it('keeps the named notification when creating a published regular badge', async () => {
      const inputDto = { name: 'Pierwsze kroki', icon: '🏅', isPublished: true };
      const actual = await service.createBadge(mockRequest, GROUP_ID, inputDto);
      expect(badgeRepository.create).toHaveBeenCalledWith(expect.objectContaining({ isSecret: false, isPublished: true }));
      expect(backlogService.notifyEnrolledStudents).toHaveBeenCalledWith(GROUP_ID, 'BADGE_ADDED', {
        message: 'Dodano nową odznakę: Pierwsze kroki.',
        badgeId: actual.id,
        badgeName: 'Pierwsze kroki',
      });
    });
  });

  describe('updateBadge', () => {
    it('denies non-owners and does not save', async () => {
      groupAuthorizationService.assertLecturerOwnsGroupFromRequest.mockRejectedValue(new ForbiddenException('Forbidden'));
      await expect(service.updateBadge(mockRequest, GROUP_ID, 1, { isSecret: true })).rejects.toThrow(ForbiddenException);
      expect(badgeRepository.save).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the badge does not exist in the group', async () => {
      badgeRepository.findOne.mockResolvedValue(null);
      await expect(service.updateBadge(mockRequest, GROUP_ID, 999, { isSecret: true })).rejects.toThrow(NotFoundException);
    });

    it('toggles the secret flag without re-notifying an already published badge', async () => {
      badgeRepository.findOne.mockResolvedValue(buildBadge({ id: 1, isSecret: false, isPublished: true }));
      const actual = await service.updateBadge(mockRequest, GROUP_ID, 1, { isSecret: true });
      expect(actual.isSecret).toBe(true);
      expect(badgeRepository.save).toHaveBeenCalledWith(expect.objectContaining({ id: 1, isSecret: true }));
      expect(backlogService.notifyEnrolledStudents).not.toHaveBeenCalled();
    });

    it('notifies students without leaking the name when publishing a secret draft badge', async () => {
      badgeRepository.findOne.mockResolvedValue(buildBadge({ id: 3, name: 'Ukryty mistrz', isSecret: true, isPublished: false }));
      const actual = await service.updateBadge(mockRequest, GROUP_ID, 3, { isPublished: true });
      expect(actual).toMatchObject({ isPublished: true, isSecret: true });
      expect(backlogService.notifyEnrolledStudents).toHaveBeenCalledWith(GROUP_ID, 'BADGE_ADDED', {
        message: 'Dodano nową sekretną odznakę.',
        badgeId: 3,
        isSecret: true,
      });
    });

    it('keeps the secret flag when it is not part of the update', async () => {
      badgeRepository.findOne.mockResolvedValue(buildBadge({ id: 3, isSecret: true, isPublished: true }));
      const actual = await service.updateBadge(mockRequest, GROUP_ID, 3, { name: 'Nowa nazwa' });
      expect(actual).toMatchObject({ name: 'Nowa nazwa', isSecret: true });
    });
  });
});
