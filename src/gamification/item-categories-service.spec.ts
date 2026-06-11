import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { AuthTokenSessionService } from '../auth/api-token/auth-token-session-service';
import { EnrollmentEntity } from '../database/entities/enrollment.entity';
import { GroupEntity } from '../database/entities/group.entity';
import { ItemCategoryEntity } from '../database/entities/item-category.entity';
import { UserRolesService } from '../user-roles/user-roles-service';
import { ItemCategoriesService } from './item-categories-service';

describe('ItemCategoriesService', () => {
  let service: ItemCategoriesService;
  let authTokenSessionService: { resolveSubjectSoftFromRequest: jest.Mock };
  let userRolesService: {
    userHasRole: jest.Mock;
    findAccountIdForRole: jest.Mock;
  };
  let groupRepository: { findOne: jest.Mock; exist: jest.Mock };
  let itemCategoryRepository: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    find: jest.Mock;
  };
  let enrollmentRepository: { exist: jest.Mock };

  const mockRequest = {} as import('express').Request;

  beforeEach(async () => {
    authTokenSessionService = {
      resolveSubjectSoftFromRequest: jest.fn().mockResolvedValue({ userId: 1 }),
    };
    userRolesService = {
      userHasRole: jest.fn().mockResolvedValue(true),
      findAccountIdForRole: jest.fn().mockImplementation((_userId: number, role: string) => {
        if (role === 'lecturer') {
          return Promise.resolve(10);
        }
        return Promise.resolve(null);
      }),
    };
    groupRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 1, teacherAccountId: 99 }),
      exist: jest.fn().mockResolvedValue(true),
    };
    itemCategoryRepository = {
      create: jest.fn((payload) => payload),
      save: jest.fn(async (payload) => ({ id: 5, ...payload })),
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
    };
    enrollmentRepository = {
      exist: jest.fn().mockResolvedValue(false),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ItemCategoriesService,
        { provide: AuthTokenSessionService, useValue: authTokenSessionService },
        { provide: UserRolesService, useValue: userRolesService },
        { provide: getRepositoryToken(ItemCategoryEntity), useValue: itemCategoryRepository },
        { provide: getRepositoryToken(GroupEntity), useValue: groupRepository },
        { provide: getRepositoryToken(EnrollmentEntity), useValue: enrollmentRepository },
      ],
    }).compile();

    service = module.get(ItemCategoriesService);
  });

  it('createCategory rejects lecturer who does not own the group', async () => {
    await expect(
      service.createCategory(mockRequest, 1, { name: 'Boosts' }),
    ).rejects.toThrow(ForbiddenException);
    expect(itemCategoryRepository.save).not.toHaveBeenCalled();
  });

  it('createCategory persists when lecturer owns the group', async () => {
    groupRepository.findOne.mockResolvedValue({ id: 1, teacherAccountId: 10 });

    const actualCategory = await service.createCategory(mockRequest, 1, { name: ' Boosts ' });

    expect(itemCategoryRepository.create).toHaveBeenCalledWith({
      groupId: 1,
      name: 'Boosts',
      description: null,
      displayOrder: null,
    });
    expect(actualCategory.id).toBe(5);
  });

  it('getCategoriesForGroup allows enrolled students', async () => {
    userRolesService.findAccountIdForRole.mockImplementation((_userId: number, role: string) => {
      if (role === 'lecturer') {
        return Promise.resolve(null);
      }
      if (role === 'student') {
        return Promise.resolve(20);
      }
      return Promise.resolve(null);
    });
    enrollmentRepository.exist.mockResolvedValue(true);

    await service.getCategoriesForGroup(mockRequest, 1);

    expect(enrollmentRepository.exist).toHaveBeenCalledWith({
      where: { groupId: 1, studentAccountId: 20 },
    });
  });

  it('getCategoriesForGroup rejects users who are not owner or enrolled', async () => {
    userRolesService.findAccountIdForRole.mockResolvedValue(null);

    await expect(service.getCategoriesForGroup(mockRequest, 1)).rejects.toThrow(ForbiddenException);
  });
});
