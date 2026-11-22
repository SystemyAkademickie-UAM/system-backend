import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';

import { AdminPatchNotesController } from './admin-patch-notes-controller';
import type { PatchNotesAccessService } from './patch-notes-access-service';
import { PatchNotesController } from './patch-notes-controller';
import type { PatchNotesService } from './patch-notes-service';

describe('PatchNotes controllers', () => {
  let mockService: {
    createPatchNote: jest.Mock;
    listPatchNotes: jest.Mock;
    getLatestPatchNote: jest.Mock;
    getLatestPatchNoteFile: jest.Mock;
    getPatchNoteFileById: jest.Mock;
    deletePatchNote: jest.Mock;
  };
  let mockAccessService: {
    resolveSuperAdminUserId: jest.Mock;
  };
  let adminController: AdminPatchNotesController;
  let publicController: PatchNotesController;

  beforeEach(() => {
    mockService = {
      createPatchNote: jest.fn(),
      listPatchNotes: jest.fn(),
      getLatestPatchNote: jest.fn(),
      getLatestPatchNoteFile: jest.fn(),
      getPatchNoteFileById: jest.fn(),
      deletePatchNote: jest.fn(),
    };
    mockAccessService = {
      resolveSuperAdminUserId: jest.fn(),
    };
    adminController = new AdminPatchNotesController(
      mockService as unknown as PatchNotesService,
      mockAccessService as unknown as PatchNotesAccessService,
    );
    publicController = new PatchNotesController(
      mockService as unknown as PatchNotesService,
    );
  });

  describe('AdminPatchNotesController', () => {
    it('uploads patch note when caller is super admin', async () => {
      mockAccessService.resolveSuperAdminUserId.mockResolvedValue(1);
      const expectedResponse = {
        id: 1,
        title: 'Patch 1.0',
        version: '1.0',
        originalFilename: 'patch.pdf',
        fileSizeBytes: 100,
        uploadedByUserId: 1,
        createdAt: '2026-11-03T10:00:00.000Z',
        fileUrl: '/api/patch-notes/1/file',
      };
      mockService.createPatchNote.mockResolvedValue(expectedResponse);
      const mockFile = { originalname: 'patch.pdf' } as Express.Multer.File;
      const actual = await adminController.upload(
        {} as Request,
        mockFile,
        { title: 'Patch 1.0', version: '1.0' },
      );
      expect(actual).toEqual(expectedResponse);
      expect(mockService.createPatchNote).toHaveBeenCalledWith(
        mockFile,
        { title: 'Patch 1.0', version: '1.0' },
        1,
      );
    });

    it('rejects upload when caller is unauthenticated (401)', async () => {
      mockAccessService.resolveSuperAdminUserId.mockRejectedValue(
        new UnauthorizedException('Unauthorized'),
      );
      await expect(
        adminController.upload({} as Request, undefined, {}),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockService.createPatchNote).not.toHaveBeenCalled();
    });

    it('rejects delete when caller lacks super role (403)', async () => {
      mockAccessService.resolveSuperAdminUserId.mockRejectedValue(
        new ForbiddenException('Forbidden'),
      );
      await expect(adminController.delete({} as Request, 5)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockService.deletePatchNote).not.toHaveBeenCalled();
    });

    it('lists patch notes for super admin with parsed pagination', async () => {
      mockAccessService.resolveSuperAdminUserId.mockResolvedValue(1);
      mockService.listPatchNotes.mockResolvedValue({ items: [], total: 0 });
      const actual = await adminController.list({} as Request, '15', '5');
      expect(actual).toEqual({ items: [], total: 0 });
      expect(mockService.listPatchNotes).toHaveBeenCalledWith(15, 5);
    });
  });

  describe('PatchNotesController', () => {
    it('lists public patch notes', async () => {
      mockService.listPatchNotes.mockResolvedValue({ items: [], total: 0 });
      const actual = await publicController.list('10', '0');
      expect(actual).toEqual({ items: [], total: 0 });
      expect(mockService.listPatchNotes).toHaveBeenCalledWith(10, 0);
    });

    it('returns latest patch note metadata', async () => {
      const expectedLatest = {
        id: 8,
        title: 'Latest Patch',
        version: 'v1.8',
        originalFilename: 'latest.pdf',
        fileSizeBytes: 256,
        uploadedByUserId: 1,
        createdAt: '2026-11-03T10:00:00.000Z',
        fileUrl: '/api/patch-notes/8/file',
      };
      mockService.getLatestPatchNote.mockResolvedValue(expectedLatest);
      const actual = await publicController.getLatest();
      expect(actual).toEqual(expectedLatest);
    });

    it('serves latest PDF binary with no-cache header', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.7 latest', 'utf8');
      mockService.getLatestPatchNoteFile.mockResolvedValue({
        buffer: pdfBuffer,
        filename: 'zmiany-żółć.pdf',
        contentType: 'application/pdf',
        sizeBytes: pdfBuffer.length,
      });
      const mockRes = {
        set: jest.fn(),
        send: jest.fn(),
      } as unknown as Response;
      await publicController.getLatestFile(undefined, mockRes);
      expect(mockRes.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'Content-Type': 'application/pdf',
          'Content-Disposition':
            'inline; filename="zmiany-____.pdf"; filename*=UTF-8\'\'zmiany-%C5%BC%C3%B3%C5%82%C4%87.pdf',
          'Cache-Control': 'no-cache',
        }),
      );
      expect(mockRes.send).toHaveBeenCalledWith(pdfBuffer);
    });

    it('serves PDF binary inline by default and attachment when download=1', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.7 test', 'utf8');
      mockService.getPatchNoteFileById.mockResolvedValue({
        buffer: pdfBuffer,
        filename: 'patch-notes.pdf',
        contentType: 'application/pdf',
        sizeBytes: pdfBuffer.length,
      });
      const mockRes = {
        set: jest.fn(),
        send: jest.fn(),
      } as unknown as Response;
      await publicController.getFileById(3, undefined, mockRes);
      expect(mockRes.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'Content-Type': 'application/pdf',
          'Content-Disposition':
            'inline; filename="patch-notes.pdf"; filename*=UTF-8\'\'patch-notes.pdf',
          'Cache-Control': 'public, max-age=300',
        }),
      );
      expect(mockRes.send).toHaveBeenCalledWith(pdfBuffer);
      await publicController.getFileById(3, '1', mockRes);
      expect(mockRes.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'Content-Disposition':
            'attachment; filename="patch-notes.pdf"; filename*=UTF-8\'\'patch-notes.pdf',
        }),
      );
    });
  });
});
