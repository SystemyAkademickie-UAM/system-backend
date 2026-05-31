import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QueryFailedError } from 'typeorm';

import { AuthTokenSessionService } from '../auth/api-token/auth-token-session-service';
import { EnrollmentCodeEntity } from '../database/entities/enrollment-code.entity';
import { GroupEntity } from '../database/entities/group.entity';
import { UserRolesService } from '../user-roles/user-roles-service';
import { EnrollmentCodesService } from './enrollment-codes-service';

function uniqueViolationError(): QueryFailedError {
  return new QueryFailedError('INSERT', [], { code: '23505' } as unknown as Error);
}

describe('EnrollmentCodesService', () => {
  let service: EnrollmentCodesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnrollmentCodesService,
        { provide: AuthTokenSessionService, useValue: {} },
        { provide: UserRolesService, useValue: {} },
        { provide: getRepositoryToken(EnrollmentCodeEntity), useValue: {} },
        { provide: getRepositoryToken(GroupEntity), useValue: {} },
      ],
    }).compile();
    service = module.get(EnrollmentCodesService);
  });

  it('validateCodeEntity rejects expired codes', () => {
    const result = service.validateCodeEntity({
      id: 1,
      groupId: 1,
      code: 'ABC',
      expiresAt: new Date('2000-01-01'),
      maxUses: null,
      useCount: 0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('expired');
    }
  });

  it('validateCodeEntity rejects code at exact expiry instant', () => {
    const asOf = new Date('2025-06-01T12:00:00.000Z');
    const result = service.validateCodeEntity(
      {
        id: 1,
        groupId: 1,
        code: 'ABC',
        expiresAt: new Date('2025-06-01T12:00:00.000Z'),
        maxUses: null,
        useCount: 0,
        isActive: true,
        createdAt: asOf,
        updatedAt: asOf,
      },
      asOf,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('expired');
    }
  });

  it('validateCodeEntity accepts code one millisecond before expiry', () => {
    const asOf = new Date('2025-06-01T12:00:00.000Z');
    const result = service.validateCodeEntity(
      {
        id: 1,
        groupId: 1,
        code: 'ABC',
        expiresAt: new Date('2025-06-01T12:00:00.001Z'),
        maxUses: null,
        useCount: 0,
        isActive: true,
        createdAt: asOf,
        updatedAt: asOf,
      },
      asOf,
    );
    expect(result.ok).toBe(true);
  });

  it('tryIncrementUseCount uses the same asOf parameter for expiry SQL guard', async () => {
    const asOf = new Date('2025-06-01T12:00:00.000Z');
    const execute = jest.fn().mockResolvedValue({ affected: 0 });
    const andWhere = jest.fn().mockReturnThis();
    const where = jest.fn().mockReturnThis();
    const set = jest.fn().mockReturnThis();
    const update = jest.fn().mockReturnThis();
    const createQueryBuilder = jest.fn().mockReturnValue({ update, set, where, andWhere, execute });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnrollmentCodesService,
        { provide: AuthTokenSessionService, useValue: {} },
        { provide: UserRolesService, useValue: {} },
        {
          provide: getRepositoryToken(EnrollmentCodeEntity),
          useValue: { createQueryBuilder },
        },
        { provide: getRepositoryToken(GroupEntity), useValue: {} },
      ],
    }).compile();
    const incrementService = module.get(EnrollmentCodesService);
    await incrementService.tryIncrementUseCount(7, asOf);
    expect(andWhere).toHaveBeenCalledWith('(expires_at IS NULL OR expires_at > :asOf)', { asOf });
  });

  it('createCode retries auto-generated save when UNIQUE constraint is hit', async () => {
    const savedEntity = {
      id: 99,
      groupId: 1,
      code: 'AABBCC',
      expiresAt: null,
      maxUses: null,
      useCount: 0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const save = jest
      .fn()
      .mockRejectedValueOnce(uniqueViolationError())
      .mockResolvedValueOnce(savedEntity);
    const create = jest.fn((entity) => entity);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnrollmentCodesService,
        {
          provide: AuthTokenSessionService,
          useValue: { resolveSubjectSoftFromRequest: jest.fn().mockResolvedValue({ userId: 1 }) },
        },
        {
          provide: UserRolesService,
          useValue: {
            userHasRole: jest.fn().mockResolvedValue(true),
            findAccountIdForRole: jest.fn().mockResolvedValue(10),
          },
        },
        {
          provide: getRepositoryToken(EnrollmentCodeEntity),
          useValue: { create, save },
        },
        {
          provide: getRepositoryToken(GroupEntity),
          useValue: { findOne: jest.fn().mockResolvedValue({ id: 1, teacherAccountId: 10 }) },
        },
      ],
    }).compile();
    const createService = module.get(EnrollmentCodesService);
    const result = await createService.createCode({} as never, 1, {});
    expect(save).toHaveBeenCalledTimes(2);
    expect(result).toEqual(savedEntity);
  });

  it('validateCodeEntity accepts active unlimited code', () => {
    const result = service.validateCodeEntity({
      id: 1,
      groupId: 1,
      code: 'ABC',
      expiresAt: null,
      maxUses: null,
      useCount: 0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(result.ok).toBe(true);
  });
});
