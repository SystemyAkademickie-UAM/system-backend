import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';

import { SessionService } from '../auth/session/session.service';
import { UserRolesService } from '../user-roles/user-roles-service';
import { BroadcastAccessService } from './broadcast-access-service';

describe('BroadcastAccessService', () => {
  let service: BroadcastAccessService;
  let sessionService: jest.Mocked<SessionService>;
  let userRolesService: jest.Mocked<UserRolesService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BroadcastAccessService,
        {
          provide: SessionService,
          useValue: {
            resolveSubjectFromRequest: jest.fn(),
          },
        },
        {
          provide: UserRolesService,
          useValue: {
            userHasRole: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BroadcastAccessService>(BroadcastAccessService);
    sessionService = module.get(SessionService);
    userRolesService = module.get(UserRolesService);
  });

  describe('resolveUserId', () => {
    it('returns userId for authenticated request', async () => {
      sessionService.resolveSubjectFromRequest.mockResolvedValueOnce({
        userId: 42,
        activeRole: 'student',
        sessionId: 1,
        organizationId: 10,
      });

      const userId = await service.resolveUserId({} as Request);
      expect(userId).toBe(42);
    });

    it('throws UnauthorizedException when session is missing', async () => {
      sessionService.resolveSubjectFromRequest.mockResolvedValueOnce(null);

      await expect(service.resolveUserId({} as Request)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('resolveSuperAdminUserId', () => {
    it('returns userId when caller holds super role', async () => {
      sessionService.resolveSubjectFromRequest.mockResolvedValueOnce({
        userId: 7,
        activeRole: 'super',
        sessionId: 1,
        organizationId: null,
      });
      userRolesService.userHasRole.mockResolvedValueOnce(true);

      const userId = await service.resolveSuperAdminUserId({} as Request);
      expect(userId).toBe(7);
      expect(userRolesService.userHasRole).toHaveBeenCalledWith(7, 'super');
    });

    it('throws ForbiddenException when caller lacks super role', async () => {
      sessionService.resolveSubjectFromRequest.mockResolvedValueOnce({
        userId: 15,
        activeRole: 'lecturer',
        sessionId: 1,
        organizationId: 10,
      });
      userRolesService.userHasRole.mockResolvedValueOnce(false);

      await expect(service.resolveSuperAdminUserId({} as Request)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
