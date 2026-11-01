import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';

import { AdminBroadcastsController } from './admin-broadcasts-controller';
import { BroadcastAccessService } from './broadcast-access-service';
import { BroadcastsService } from './broadcasts-service';
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

    it('deletes broadcast by id', async () => {
      (broadcastsService.deleteBroadcast as jest.Mock).mockResolvedValue({ deleted: true });
      const res = await adminController.delete(mockRequest, 5);
      expect(broadcastsService.deleteBroadcast).toHaveBeenCalledWith(5);
      expect(res).toEqual({ deleted: true });
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
});
