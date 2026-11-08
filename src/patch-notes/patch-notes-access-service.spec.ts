import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

import type { SessionService } from '../auth/session/session.service';
import { SUPER_ROLE_NAME } from '../constants/role-name-constants';
import type { UserRolesService } from '../user-roles/user-roles-service';
import { PatchNotesAccessService } from './patch-notes-access-service';

describe('PatchNotesAccessService', () => {
  let mockSessionService: { resolveSubjectFromRequest: jest.Mock };
  let mockUserRolesService: { userHasRole: jest.Mock };
  let service: PatchNotesAccessService;

  beforeEach(() => {
    mockSessionService = {
      resolveSubjectFromRequest: jest.fn(),
    };
    mockUserRolesService = {
      userHasRole: jest.fn(),
    };
    service = new PatchNotesAccessService(
      mockSessionService as unknown as SessionService,
      mockUserRolesService as unknown as UserRolesService,
    );
  });

  describe('canActivate', () => {
    it('returns true and caches superAdminUserId on request when caller is super', async () => {
      mockSessionService.resolveSubjectFromRequest.mockResolvedValue({ userId: 9 });
      mockUserRolesService.userHasRole.mockResolvedValue(true);
      const mockReq: Record<string, unknown> = {};
      const mockCtx = {
        switchToHttp: () => ({ getRequest: () => mockReq }),
      } as unknown as ExecutionContext;
      const actual = await service.canActivate(mockCtx);
      expect(actual).toBe(true);
      expect(mockReq.superAdminUserId).toBe(9);
    });
  });

  describe('resolveUserId', () => {
    it('returns userId when session is valid', async () => {
      mockSessionService.resolveSubjectFromRequest.mockResolvedValue({ userId: 42 });
      const actualUserId = await service.resolveUserId({} as Request);
      expect(actualUserId).toBe(42);
    });

    it('throws UnauthorizedException when session is missing', async () => {
      mockSessionService.resolveSubjectFromRequest.mockResolvedValue(null);
      await expect(service.resolveUserId({} as Request)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('resolveSuperAdminUserId', () => {
    it('returns userId when user holds super role', async () => {
      mockSessionService.resolveSubjectFromRequest.mockResolvedValue({ userId: 7 });
      mockUserRolesService.userHasRole.mockResolvedValue(true);
      const actualUserId = await service.resolveSuperAdminUserId({} as Request);
      expect(actualUserId).toBe(7);
      expect(mockUserRolesService.userHasRole).toHaveBeenCalledWith(7, SUPER_ROLE_NAME);
    });

    it('throws UnauthorizedException when caller is unauthenticated', async () => {
      mockSessionService.resolveSubjectFromRequest.mockResolvedValue(null);
      await expect(service.resolveSuperAdminUserId({} as Request)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws ForbiddenException when authenticated user lacks super role', async () => {
      mockSessionService.resolveSubjectFromRequest.mockResolvedValue({ userId: 15 });
      mockUserRolesService.userHasRole.mockResolvedValue(false);
      await expect(service.resolveSuperAdminUserId({} as Request)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
