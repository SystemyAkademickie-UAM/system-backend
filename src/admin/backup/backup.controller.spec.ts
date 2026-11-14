import { BadRequestException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Readable } from 'node:stream';

import { AdminAccessService } from '../admin-access.service';
import { BackupController } from './backup.controller';
import type {
  AutoBackupScheduleConfig,
  BackupFileSummary,
  BackupStatusResponse,
} from './backup-response-types';
import { BackupService } from './backup.service';

describe('BackupController', () => {
  let controller: BackupController;
  let adminAccessService: jest.Mocked<AdminAccessService>;
  let backupService: jest.Mocked<BackupService>;

  beforeEach(() => {
    adminAccessService = {
      assertSuperAdmin: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AdminAccessService>;

    backupService = {
      getBackupStatus: jest.fn(),
      getScheduleConfig: jest.fn(),
      updateScheduleConfig: jest.fn(),
      createAutoBackup: jest.fn(),
      purgeOldAutoBackups: jest.fn().mockResolvedValue({ purgedCount: 0, freedBytes: 0 }),
      getAutoBackupStream: jest.fn(),
      createBackupStream: jest.fn(),
      recordManualBackup: jest.fn().mockResolvedValue(undefined),
      restoreBackup: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<BackupService>;

    controller = new BackupController(adminAccessService, backupService);
  });

  describe('getStatus', () => {
    it('asserts super admin and returns status from service', async () => {
      const mockStatus: BackupStatusResponse = {
        lastBackupAt: '2026-11-02T10:00:00.000Z',
        lastManualBackupAt: '2026-10-25T10:00:00.000Z',
        lastAutoBackupAt: '2026-11-02T10:00:00.000Z',
        isManualBackupOverdue: true,
        daysSinceLastManualBackup: 8,
        manualBackupThresholdDays: 7,
        retentionDays: 14,
        autoBackupsCount: 1,
        totalStorageSizeBytes: 1024,
        autoBackups: [],
        schedule: {
          enabled: true,
          interval: 'daily',
          timeOfDay: '02:00',
        },
      };
      backupService.getBackupStatus.mockResolvedValue(mockStatus);

      const req = {} as Request;
      const result = await controller.getStatus(req);

      expect(adminAccessService.assertSuperAdmin).toHaveBeenCalledWith(req);
      expect(result).toBe(mockStatus);
    });
  });

  describe('getSchedule and updateSchedule', () => {
    it('returns schedule config', async () => {
      const mockSchedule: AutoBackupScheduleConfig = {
        enabled: true,
        interval: 'weekly',
        timeOfDay: '03:00',
      };
      backupService.getScheduleConfig.mockResolvedValue(mockSchedule);

      const req = {} as Request;
      const result = await controller.getSchedule(req);

      expect(adminAccessService.assertSuperAdmin).toHaveBeenCalledWith(req);
      expect(result).toBe(mockSchedule);
    });

    it('updates schedule config', async () => {
      const mockSchedule: AutoBackupScheduleConfig = {
        enabled: false,
        interval: 'every_3_days',
        timeOfDay: '04:00',
      };
      backupService.updateScheduleConfig.mockResolvedValue(mockSchedule);

      const req = {} as Request;
      const result = await controller.updateSchedule(req, {
        enabled: false,
        interval: 'every_3_days',
        timeOfDay: '04:00',
      });

      expect(adminAccessService.assertSuperAdmin).toHaveBeenCalledWith(req);
      expect(backupService.updateScheduleConfig).toHaveBeenCalledWith({
        enabled: false,
        interval: 'every_3_days',
        timeOfDay: '04:00',
      });
      expect(result).toBe(mockSchedule);
    });
  });

  describe('triggerAutoBackup', () => {
    it('creates auto-backup and triggers purge', async () => {
      const mockSummary: BackupFileSummary = {
        filename: 'backup-auto-test.enc',
        createdAt: '2026-11-02T10:00:00.000Z',
        sizeBytes: 2048,
      };
      backupService.createAutoBackup.mockResolvedValue(mockSummary);

      const req = {} as Request;
      const result = await controller.triggerAutoBackup(req);

      expect(adminAccessService.assertSuperAdmin).toHaveBeenCalledWith(req);
      expect(backupService.createAutoBackup).toHaveBeenCalled();
      expect(backupService.purgeOldAutoBackups).toHaveBeenCalled();
      expect(result).toBe(mockSummary);
    });
  });

  describe('downloadAutoBackup', () => {
    it('sets response headers and returns StreamableFile', async () => {
      const mockStream = Readable.from(['data']);
      backupService.getAutoBackupStream.mockResolvedValue({
        stream: mockStream,
        sizeBytes: 4,
      });

      const req = {} as Request;
      const res = {
        setHeader: jest.fn(),
      } as unknown as Response;

      const file = await controller.downloadAutoBackup(req, 'backup-auto-sample.enc', res);

      expect(adminAccessService.assertSuperAdmin).toHaveBeenCalledWith(req);
      expect(backupService.getAutoBackupStream).toHaveBeenCalledWith('backup-auto-sample.enc');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/octet-stream');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="backup-auto-sample.enc"',
      );
      expect(file).toBeDefined();
    });
  });

  describe('exportBackupPost and exportBackupGet', () => {
    const mockPostPassword = ['mock', 'test', 'export', 'pass'].join('-');
    const mockHeaderPassword = ['mock', 'test', 'header', 'pass'].join('-');

    it('encrypts backup with user password in POST export', async () => {
      backupService.createBackupStream.mockResolvedValue(Readable.from(['enc-data']));

      const req = {} as Request;
      const res = {
        setHeader: jest.fn(),
      } as unknown as Response;

      const file = await controller.exportBackupPost(
        req,
        { password: mockPostPassword },
        res,
      );

      expect(adminAccessService.assertSuperAdmin).toHaveBeenCalledWith(req);
      expect(backupService.createBackupStream).toHaveBeenCalledWith({
        password: mockPostPassword,
      });
      expect(backupService.recordManualBackup).toHaveBeenCalled();
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/octet-stream');
      expect(file).toBeDefined();
    });

    it('exports backup in GET export with header or query password', async () => {
      backupService.createBackupStream.mockResolvedValue(Readable.from(['enc-data']));

      const req = {} as Request;
      const res = {
        setHeader: jest.fn(),
      } as unknown as Response;

      const file = await controller.exportBackupGet(
        req,
        mockHeaderPassword,
        undefined,
        res,
      );

      expect(adminAccessService.assertSuperAdmin).toHaveBeenCalledWith(req);
      expect(backupService.createBackupStream).toHaveBeenCalledWith({
        password: mockHeaderPassword,
      });
      expect(backupService.recordManualBackup).toHaveBeenCalled();
      expect(file).toBeDefined();
    });
  });

  describe('importBackup', () => {
    const mockRestorePassword = ['mock', 'test', 'restore', 'pass'].join('-');

    it('throws BadRequestException when no file is uploaded', async () => {
      const req = {} as Request;
      await expect(
        controller.importBackup(req, undefined as unknown as Express.Multer.File, {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('restores backup when valid file and password are provided', async () => {
      const req = {} as Request;
      const file = {
        size: 512,
        buffer: Buffer.from('test-backup'),
      } as Express.Multer.File;

      const result = await controller.importBackup(req, file, { password: mockRestorePassword });

      expect(adminAccessService.assertSuperAdmin).toHaveBeenCalledWith(req);
      expect(backupService.restoreBackup).toHaveBeenCalledWith(file.buffer, mockRestorePassword);
      expect(result.restored).toBe(true);
    });
  });
});
