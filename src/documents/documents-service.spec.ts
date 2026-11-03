import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';

import { DOCUMENTS_STORAGE_DIR_ENV } from '../constants/system-documents-constants';
import type { SystemDocumentEntity } from '../database/entities/system-document.entity';
import { DocumentsService } from './documents-service';

function createValidPdfMulterFile(
  filename = 'warunki-uzytkowania.pdf',
  content = '%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF',
  mimetype = 'application/pdf',
): Express.Multer.File {
  const buffer = Buffer.from(content, 'utf8');
  return {
    fieldname: 'file',
    originalname: filename,
    encoding: '7bit',
    mimetype,
    size: buffer.length,
    buffer,
    stream: null as never,
    destination: '',
    filename: '',
    path: '',
  };
}

describe('DocumentsService', () => {
  let tempDir: string;
  let mockRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };
  let service: DocumentsService;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'maq-documents-test-'));
    process.env[DOCUMENTS_STORAGE_DIR_ENV] = tempDir;
    mockRepository = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((data: Partial<SystemDocumentEntity>) => ({ ...data })),
      save: jest.fn(async (entity: Partial<SystemDocumentEntity>) => ({
        id: 1,
        ...entity,
      })),
      delete: jest.fn(),
    };
    service = new DocumentsService(
      mockRepository as unknown as Repository<SystemDocumentEntity>,
    );
  });

  afterEach(async () => {
    delete process.env[DOCUMENTS_STORAGE_DIR_ENV];
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('listDocuments & getDocument', () => {
    it('lists all 3 system documents with isUploaded=false when empty', async () => {
      const actual = await service.listDocuments();
      expect(actual.items).toHaveLength(3);
      expect(actual.items.map((i) => i.key)).toEqual([
        'termsOfUse',
        'privacyPolicy',
        'documentation',
      ]);
      expect(actual.items.every((i) => i.isUploaded === false)).toBe(true);
    });

    it('throws BadRequestException for unknown document key', async () => {
      await expect(service.getDocument('unknownDoc')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('upsertDocument & getDocumentFile', () => {
    it('uploads and replaces PDF for a valid document key or alias', async () => {
      const inputFile = createValidPdfMulterFile('polityka-nowa.pdf');
      const actual = await service.upsertDocument(
        'privacy-policy',
        inputFile,
        { title: 'Polityka Prywatności' },
        1,
      );
      expect(actual.key).toBe('privacyPolicy');
      expect(actual.isUploaded).toBe(true);
      expect(actual.title).toBe('Polityka Prywatności');
      expect(actual.originalFilename).toBe('polityka-nowa.pdf');
      expect(actual.fileSizeBytes).toBe(inputFile.buffer.length);
      expect(actual.fileUrl).toBe('/api/documents/privacyPolicy/file');
      const storedPayload = await service.getDocumentFile('privacyPolicy');
      expect(storedPayload.buffer.equals(inputFile.buffer)).toBe(true);
      expect(storedPayload.contentType).toBe('application/pdf');
    });

    it('rejects non-PDF content without %PDF- magic header', async () => {
      const fakeFile = createValidPdfMulterFile('fake.pdf', 'not a pdf file');
      await expect(
        service.upsertDocument('termsOfUse', fakeFile, {}, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when reading file of unuploaded document', async () => {
      await expect(service.getDocumentFile('documentation')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deleteDocument', () => {
    it('deletes uploaded PDF file from disk and database', async () => {
      const inputFile = createValidPdfMulterFile('warunki.pdf');
      await service.upsertDocument('termsOfUse', inputFile, {}, 1);
      mockRepository.findOne.mockResolvedValueOnce({
        id: 5,
        documentKey: 'termsOfUse',
      });
      const result = await service.deleteDocument('warunki-uzytkowania.pdf');
      expect(result).toEqual({ deleted: true, key: 'termsOfUse' });
      const filesAfter = await readdir(tempDir);
      expect(filesAfter).toHaveLength(0);
    });

    it('throws NotFoundException when deleting document that is not uploaded', async () => {
      await expect(service.deleteDocument('documentation')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

