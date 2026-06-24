import { Test, TestingModule } from '@nestjs/testing';
import { BacklogController } from './backlog-controller';
import { BacklogService } from './backlog-service';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';

describe('BacklogController', () => {
  let controller: BacklogController;
  let service: jest.Mocked<BacklogService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BacklogController],
      providers: [
        {
          provide: BacklogService,
          useValue: {
            getStudentBacklog: jest.fn(),
            getGroupBacklog: jest.fn(),
            markAsRead: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<BacklogController>(BacklogController);
    service = module.get(BacklogService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getStudentBacklog', () => {
    it('should return backlog items when successful', async () => {
      // Arrange
      const mockReq = {} as Request;
      const expectedItems = [
        { id: 1, type: 'TEST', date: '2026-01-01', value: '1', accountId: 1, isRead: false },
        { id: 2, type: 'TEST2', date: '2026-01-02', value: '2', accountId: 1, isRead: true },
      ];
      service.getStudentBacklog.mockResolvedValue(expectedItems);

      // Act
      const result = await controller.getStudentBacklog(1, mockReq);

      // Assert
      expect(result).toEqual(expectedItems);
      expect(service.getStudentBacklog).toHaveBeenCalledWith(mockReq, 1, 50, 0);
    });

    it('should throw UnauthorizedException when service returns an error', async () => {
      // Arrange
      const mockReq = {} as Request;
      service.getStudentBacklog.mockResolvedValue({ error: 'Unauthorized' });

      // Act & Assert
      await expect(controller.getStudentBacklog(1, mockReq)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw ForbiddenException when service returns a Forbidden error', async () => {
      // Arrange
      const mockReq = {} as Request;
      service.getStudentBacklog.mockResolvedValue({ error: 'Forbidden: access denied' });

      // Act & Assert
      await expect(controller.getStudentBacklog(1, mockReq)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('getGroupBacklog', () => {
    it('should return group backlog items when successful', async () => {
      // Arrange
      const mockReq = {} as Request;
      const expectedItems = [{ id: 1, type: 'SHOP_PURCHASE', date: '2026-06-07', value: '10', accountId: 1, isRead: false }];
      service.getGroupBacklog.mockResolvedValue(expectedItems);

      // Act
      const result = await controller.getGroupBacklog(1, mockReq);

      // Assert
      expect(result).toEqual(expectedItems);
      expect(service.getGroupBacklog).toHaveBeenCalledWith(mockReq, 1, 50, 0);
    });

    it('should throw UnauthorizedException when service returns an unauthorized error', async () => {
      // Arrange
      const mockReq = {} as Request;
      service.getGroupBacklog.mockResolvedValue({ error: 'Unauthorized' });

      // Act & Assert
      await expect(controller.getGroupBacklog(1, mockReq)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw ForbiddenException when service returns a Forbidden error', async () => {
      // Arrange
      const mockReq = {} as Request;
      service.getGroupBacklog.mockResolvedValue({ error: 'Forbidden: access denied' });

      // Act & Assert
      await expect(controller.getGroupBacklog(1, mockReq)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('markAsRead', () => {
    it('should return updated result when service succeeds', async () => {
      // Arrange
      const mockReq = {} as Request;
      service.markAsRead.mockResolvedValue({ updated: true });

      // Act
      const result = await controller.markAsRead(100001, 42, mockReq);

      // Assert
      expect(result).toEqual({ updated: true });
      expect(service.markAsRead).toHaveBeenCalledWith(mockReq, 100001, 42);
    });

    it('should return updated: false when no backlog row matched', async () => {
      // Arrange
      const mockReq = {} as Request;
      service.markAsRead.mockResolvedValue({ updated: false });

      // Act
      const result = await controller.markAsRead(100001, 42, mockReq);

      // Assert
      expect(result).toEqual({ updated: false });
    });

    it('should throw ForbiddenException when service returns a Forbidden error', async () => {
      // Arrange
      const mockReq = {} as Request;
      service.markAsRead.mockResolvedValue({ error: 'Forbidden: Not enrolled' });

      // Act & Assert
      await expect(controller.markAsRead(100001, 42, mockReq)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw UnauthorizedException when service returns an unauthorized error', async () => {
      // Arrange
      const mockReq = {} as Request;
      service.markAsRead.mockResolvedValue({ error: 'Unauthorized' });

      // Act & Assert
      await expect(controller.markAsRead(100001, 42, mockReq)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
