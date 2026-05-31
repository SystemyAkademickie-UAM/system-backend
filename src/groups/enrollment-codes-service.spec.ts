import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { AuthTokenSessionService } from '../auth/api-token/auth-token-session-service';
import { EnrollmentCodeEntity } from '../database/entities/enrollment-code.entity';
import { GroupEntity } from '../database/entities/group.entity';
import { UserRolesService } from '../user-roles/user-roles-service';
import { EnrollmentCodesService } from './enrollment-codes-service';

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
