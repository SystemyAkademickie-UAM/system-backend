import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';

import { AdminDocumentsController } from './admin-documents-controller';
import type { DocumentsAccessService } from './documents-access-service';
import { DocumentsController } from './documents-controller';
import type { DocumentsService } from './documents-service';

describe('Documents controllers', () => {
  let mockService: {
    listDocuments: jest.Mock;
    listPublicDocuments: jest.Mock;
    getDocument: jest.Mock;
    getPublicDocument: jest.Mock;
    getDocumentFile: jest.Mock;
    upsertDocument: jest.Mock;
    deleteDocument: jest.Mock;
  };
  let mockAccessService: {
    resolveSuperAdminUserId: jest.Mock;
  };
  let adminController: AdminDocumentsController;
  let publicController: DocumentsController;

  beforeEach(() => {
    mockService = {
      listDocuments: jest.fn(),
      listPublicDocuments: jest.fn(),
      getDocument: jest.fn(),
      getPublicDocument: jest.fn(),
      getDocumentFile: jest.fn(),
      upsertDocument: jest.fn(),
      deleteDocument: jest.fn(),
    };
    mockAccessService = {
      resolveSuperAdminUserId: jest.fn(),
    };
    adminController = new AdminDocumentsController(
      mockService as unknown as DocumentsService,
      mockAccessService as unknown as DocumentsAccessService,
    );
    publicController = new DocumentsController(
      mockService as unknown as DocumentsService,
    );
  });

  describe('AdminDocumentsController', () => {
    it('lists documents for super admin', async () => {
      mockAccessService.resolveSuperAdminUserId.mockResolvedValue(1);
      mockService.listDocuments.mockResolvedValue({ items: [] });
      const actual = await adminController.list({} as Request);
      expect(actual).toEqual({ items: [] });
    });

    it('gets single document metadata for super admin', async () => {
      mockAccessService.resolveSuperAdminUserId.mockResolvedValue(1);
      const expectedDoc = {
        key: 'termsOfUse',
        title: 'Terms of Use',
        canonicalFilename: 'warunki-uzytkowania.pdf',
        isUploaded: true,
        originalFilename: 'warunki.pdf',
        fileSizeBytes: 120,
        uploadedAt: '2026-11-03T12:00:00.000Z',
        uploadedByUserId: 1,
        fileUrl: '/api/documents/termsOfUse/file',
      };
      mockService.getDocument.mockResolvedValue(expectedDoc);
      const actual = await adminController.getOne({} as Request, 'termsOfUse');
      expect(actual).toEqual(expectedDoc);
    });

    it('serves document PDF file for super admin inspection', async () => {
      mockAccessService.resolveSuperAdminUserId.mockResolvedValue(1);
      const pdfBuffer = Buffer.from('%PDF-1.7 doc', 'utf8');
      mockService.getDocumentFile.mockResolvedValue({
        buffer: pdfBuffer,
        filename: 'warunki-użytkowania.pdf',
        contentType: 'application/pdf',
        sizeBytes: pdfBuffer.length,
      });
      const mockRes = {
        set: jest.fn(),
        send: jest.fn(),
      } as unknown as Response;
      await adminController.getFile({} as Request, 'termsOfUse', undefined, mockRes);
      expect(mockRes.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'Content-Type': 'application/pdf',
          'Content-Disposition':
            'inline; filename="warunki-u_ytkowania.pdf"; filename*=UTF-8\'\'warunki-u%C5%BCytkowania.pdf',
        }),
      );
      expect(mockRes.send).toHaveBeenCalledWith(pdfBuffer);
    });

    it('replaces document via PUT and POST for super admin', async () => {
      mockAccessService.resolveSuperAdminUserId.mockResolvedValue(1);
      const expected = { key: 'privacyPolicy', isUploaded: true };
      mockService.upsertDocument.mockResolvedValue(expected);
      const mockFile = { originalname: 'privacy.pdf' } as Express.Multer.File;
      const actualPut = await adminController.replace(
        {} as Request,
        'privacyPolicy',
        mockFile,
        { title: 'Privacy Policy' },
      );
      expect(actualPut).toEqual(expected);
      const actualPost = await adminController.upload(
        {} as Request,
        'privacyPolicy',
        mockFile,
        {},
      );
      expect(actualPost).toEqual(expected);
    });

    it('deletes document for super admin', async () => {
      mockAccessService.resolveSuperAdminUserId.mockResolvedValue(1);
      mockService.deleteDocument.mockResolvedValue({
        deleted: true,
        key: 'documentation',
      });
      const actual = await adminController.delete({} as Request, 'documentation');
      expect(actual).toEqual({ deleted: true, key: 'documentation' });
    });

    it('rejects unauthenticated (401) and non-super (403) callers', async () => {
      mockAccessService.resolveSuperAdminUserId.mockRejectedValueOnce(
        new UnauthorizedException('Unauthorized'),
      );
      await expect(adminController.list({} as Request)).rejects.toThrow(
        UnauthorizedException,
      );
      mockAccessService.resolveSuperAdminUserId.mockRejectedValueOnce(
        new ForbiddenException('Forbidden'),
      );
      await expect(
        adminController.delete({} as Request, 'termsOfUse'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('DocumentsController', () => {
    it('lists and fetches public document metadata without uploadedByUserId', async () => {
      mockService.listPublicDocuments.mockResolvedValue({ items: [] });
      expect(await publicController.list()).toEqual({ items: [] });
      mockService.getPublicDocument.mockResolvedValue({ key: 'termsOfUse' });
      expect(await publicController.getOne('termsOfUse')).toEqual({
        key: 'termsOfUse',
      });
    });

    it('serves public document PDF inline and as attachment when download=1', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.7 public', 'utf8');
      mockService.getDocumentFile.mockResolvedValue({
        buffer: pdfBuffer,
        filename: 'polityka-prywatnosci.pdf',
        contentType: 'application/pdf',
        sizeBytes: pdfBuffer.length,
      });
      const mockRes = {
        set: jest.fn(),
        send: jest.fn(),
      } as unknown as Response;
      await publicController.getFile('privacyPolicy', '1', mockRes);
      expect(mockRes.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'Content-Disposition':
            'attachment; filename="polityka-prywatnosci.pdf"; filename*=UTF-8\'\'polityka-prywatnosci.pdf',
          'Cache-Control': 'no-cache',
        }),
      );
      expect(mockRes.send).toHaveBeenCalledWith(pdfBuffer);
    });
  });
});

