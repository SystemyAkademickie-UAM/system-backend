import { BadRequestException } from '@nestjs/common';
import type { Request } from 'express';
import { unlink } from 'node:fs/promises';

import { DriveService } from './drive-service';

jest.mock('node:fs/promises', () => ({
  mkdir: jest.fn(),
  readFile: jest.fn(),
  stat: jest.fn(),
  unlink: jest.fn(),
  writeFile: jest.fn(),
}));

describe('DriveService', () => {
  describe('isValidDriveRef', () => {
    it('should accept a valid UUID v4', () => {
      expect(DriveService.isValidDriveRef('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    it('should accept uppercase UUID', () => {
      expect(DriveService.isValidDriveRef('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
    });

    it('should reject an empty string', () => {
      expect(DriveService.isValidDriveRef('')).toBe(false);
    });

    it('should reject a plain string', () => {
      expect(DriveService.isValidDriveRef('not-a-uuid')).toBe(false);
    });

    it('should reject path traversal attempts', () => {
      expect(DriveService.isValidDriveRef('../../../etc/passwd')).toBe(false);
    });

    it('should reject UUID with extra characters', () => {
      expect(DriveService.isValidDriveRef('550e8400-e29b-41d4-a716-446655440000-extra')).toBe(false);
    });

    it('should reject UUID missing dashes', () => {
      expect(DriveService.isValidDriveRef('550e8400e29b41d4a716446655440000')).toBe(false);
    });
  });

  describe('handleDrive remove', () => {
    it('does not delete a file when driveRef is not a UUID', async () => {
      const sessionService = {
        resolveSubjectFromRequest: jest.fn().mockResolvedValue({ userId: 1 }),
      };
      const userRolesService = {
        userHasRole: jest.fn().mockResolvedValue(true),
      };
      const service = new DriveService(sessionService as never, userRolesService as never);
      const jsonField = JSON.stringify({
        drive: { method: 'remove', driveRef: 'not-a-uuid', size: 0 },
      });
      await expect(
        service.handleDrive({
          req: {} as Request,
          jsonField,
          bannerFile: undefined,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(unlink).not.toHaveBeenCalled();
    });
  });
});
