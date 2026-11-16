import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { Request } from 'express';

import { AdminBroadcastsController } from './admin-broadcasts-controller';
import { BroadcastAccessService } from './broadcast-access-service';
import { BroadcastsService } from './broadcasts-service';
import { CreateBroadcastDto } from './dto/create-broadcast.dto';
import { UpdateBroadcastDto } from './dto/update-broadcast.dto';
import { UserBroadcastsController } from './user-broadcasts-controller';
import { UserRolesService } from '../user-roles/user-roles-service';

describe('Broadcasts Controllers', () => {
  let adminController: AdminBroadcastsController;
  let userController: UserBroadcastsController;
  let broadcastsService: jest.Mocked<Partial<BroadcastsService>>;
  let accessService: jest.Mocked<Partial<BroadcastAccessService>>;
  let userRolesService: jest.Mocked<Partial<UserRolesService>>;

  const mockRequest = {} as Request;

  beforeEach(async () => {
    broadcastsService = {
      createBroadcast: jest.fn(),
      getBroadcastById: jest.fn(),
      updateBroadcast: jest.fn(),
      deleteBroadcast: jest.fn(),
      listAdminBroadcasts: jest.fn(),
      listActiveForUser: jest.fn(),
      markAsRead: jest.fn(),
    };

    accessService = {
      resolveUserId: jest.fn().mockResolvedValue(10),
      resolveSuperAdminUserId: jest.fn().mockResolvedValue(1),
    };

    userRolesService = {
      listRolesForUser: jest.fn().mockResolvedValue(['student']),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [
        AdminBroadcastsController,
        UserBroadcastsController,
      ],
      providers: [
        { provide: BroadcastsService, useValue: broadcastsService },
        { provide: BroadcastAccessService, useValue: accessService },
        { provide: UserRolesService, useValue: userRolesService },
      ],
    }).compile();

    adminController = module.get(AdminBroadcastsController);
    userController = module.get(UserBroadcastsController);
  });

  describe('AdminBroadcastsController', () => {
    it('creates broadcast after verifying superadmin', async () => {
      (broadcastsService.createBroadcast as jest.Mock).mockResolvedValue({ id: 1, title: 'T' });
      const res = await adminController.create(mockRequest, { title: 'T', content: 'C' });
      expect(accessService.resolveSuperAdminUserId).toHaveBeenCalledWith(mockRequest);
      expect(broadcastsService.createBroadcast).toHaveBeenCalledWith({ title: 'T', content: 'C' }, 1);
      expect(res).toEqual({ id: 1, title: 'T' });
    });

    it('lists broadcasts for admin', async () => {
      (broadcastsService.listAdminBroadcasts as jest.Mock).mockResolvedValue({ items: [], total: 0 });
      await adminController.list(mockRequest, '10', '0');
      expect(broadcastsService.listAdminBroadcasts).toHaveBeenCalledWith(10, 0);
    });

    it('gets single broadcast by id after verifying superadmin', async () => {
      const expected = { id: 5, title: 'Notice' };
      (broadcastsService.getBroadcastById as jest.Mock).mockResolvedValue(expected);
      const actual = await adminController.getOne(mockRequest, 5);
      expect(accessService.resolveSuperAdminUserId).toHaveBeenCalledWith(mockRequest);
      expect(broadcastsService.getBroadcastById).toHaveBeenCalledWith(5);
      expect(actual).toEqual(expected);
    });

    it('updates broadcast via PUT after verifying superadmin', async () => {
      const inputDto = { title: 'Updated', content: 'Updated body', level: 'warning' as const };
      const expected = { id: 5, ...inputDto };
      (broadcastsService.updateBroadcast as jest.Mock).mockResolvedValue(expected);
      const actual = await adminController.update(mockRequest, 5, inputDto);
      expect(accessService.resolveSuperAdminUserId).toHaveBeenCalledWith(mockRequest);
      expect(broadcastsService.updateBroadcast).toHaveBeenCalledWith(5, inputDto);
      expect(actual).toEqual(expected);
    });

    it('partially updates broadcast via PATCH after verifying superadmin', async () => {
      const inputDto = { title: 'Patched title' };
      const expected = { id: 5, title: 'Patched title' };
      (broadcastsService.updateBroadcast as jest.Mock).mockResolvedValue(expected);
      const actual = await adminController.patch(mockRequest, 5, inputDto);
      expect(accessService.resolveSuperAdminUserId).toHaveBeenCalledWith(mockRequest);
      expect(broadcastsService.updateBroadcast).toHaveBeenCalledWith(5, inputDto);
      expect(actual).toEqual(expected);
    });

    it('deletes broadcast by id', async () => {
      (broadcastsService.deleteBroadcast as jest.Mock).mockResolvedValue({ deleted: true });
      const res = await adminController.delete(mockRequest, 5);
      expect(broadcastsService.deleteBroadcast).toHaveBeenCalledWith(5);
      expect(res).toEqual({ deleted: true });
    });

    it('denies update when caller lacks super role', async () => {
      (accessService.resolveSuperAdminUserId as jest.Mock).mockRejectedValueOnce(
        new ForbiddenException('Forbidden: Requires super role'),
      );
      await expect(
        adminController.update(mockRequest, 5, { title: 'Updated' }),
      ).rejects.toThrow(ForbiddenException);
      expect(broadcastsService.updateBroadcast).not.toHaveBeenCalled();
    });
  });

  describe('UserBroadcastsController', () => {
    it('fetches active broadcasts for current user and roles', async () => {
      (broadcastsService.listActiveForUser as jest.Mock).mockResolvedValue([]);
      const res = await userController.getMyBroadcasts(mockRequest);
      expect(accessService.resolveUserId).toHaveBeenCalledWith(mockRequest);
      expect(userRolesService.listRolesForUser).toHaveBeenCalledWith(10);
      expect(broadcastsService.listActiveForUser).toHaveBeenCalledWith(10, ['student']);
      expect(res).toEqual([]);
    });

    it('marks broadcast as read', async () => {
      (broadcastsService.markAsRead as jest.Mock).mockResolvedValue({ read: true });
      const res = await userController.markAsRead(mockRequest, 3);
      expect(broadcastsService.markAsRead).toHaveBeenCalledWith(10, 3);
      expect(res).toEqual({ read: true });
    });
  });

  describe('Broadcast DTO validation', () => {
    it('rejects whitespace-only title and normalizes empty expiresAt on CreateBroadcastDto', async () => {
      const invalidDto = plainToInstance(CreateBroadcastDto, {
        title: '   ',
        content: 'Valid content',
        expiresAt: '',
      });
      const errors = await validate(invalidDto);
      expect(invalidDto.expiresAt).toBeNull();
      expect(errors.some((e) => e.property === 'title')).toBe(true);
      expect(errors.some((e) => e.property === 'expiresAt')).toBe(false);
    });

    it('allows clearing expiresAt with null or empty string and rejects null title on UpdateBroadcastDto', async () => {
      const validClearDto = plainToInstance(UpdateBroadcastDto, {
        title: '  Updated  ',
        expiresAt: '',
      });
      const validErrors = await validate(validClearDto);
      expect(validErrors).toHaveLength(0);
      expect(validClearDto.title).toBe('Updated');
      expect(validClearDto.expiresAt).toBeNull();

      const invalidNullTitleDto = plainToInstance(UpdateBroadcastDto, {
        title: null,
      });
      const invalidErrors = await validate(invalidNullTitleDto);
      expect(invalidErrors.some((e) => e.property === 'title')).toBe(true);
    });
  });
});
