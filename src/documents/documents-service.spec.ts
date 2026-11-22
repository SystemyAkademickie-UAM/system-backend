import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
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
  let storedEntities: Map<string, SystemDocumentEntity>;
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
    storedEntities = new Map<string, SystemDocumentEntity>();
    let nextId = 1;
    mockRepository = {
      find: jest.fn(async () => Array.from(storedEntities.values())),
      findOne: jest.fn(
        async (opts?: { where?: { documentKey?: string } }) =>
          (opts?.where?.documentKey
            ? storedEntities.get(opts.where.documentKey)
            : null) ?? null,
      ),
      create: jest.fn((data: Partial<SystemDocumentEntity>) => ({ ...data })),
      save: jest.fn(async (entity: Partial<SystemDocumentEntity>) => {
        const saved = {
          id: entity.id ?? nextId++,
          ...entity,
        } as SystemDocumentEntity;
        if (saved.documentKey) {
          storedEntities.set(saved.documentKey, saved);
        }
        return saved;
      }),
      delete: jest.fn(async (id: number) => {
        for (const [key, value] of storedEntities.entries()) {
          if (value.id === id) {
            storedEntities.delete(key);
          }
        }
      }),
    };
    service = new DocumentsService(
      mockRepository as unknown as Repository<SystemDocumentEntity>,
    );
  });

  afterEach(async () => {
    delete process.env[DOCUMENTS_STORAGE_DIR_ENV];
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('listDocuments, listPublicDocuments & getDocument', () => {
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

    it('omits uploadedByUserId from public document responses while keeping it on admin responses', async () => {
      const inputFile = createValidPdfMulterFile('regulamin.pdf');
      await service.upsertDocument('termsOfUse', inputFile, {}, 42);
      const adminDoc = await service.getDocument('termsOfUse');
      expect(adminDoc.uploadedByUserId).toBe(42);
      const publicDoc = await service.getPublicDocument('termsOfUse');
      expect('uploadedByUserId' in publicDoc).toBe(false);
      const publicList = await service.listPublicDocuments();
      expect(
        publicList.items.every((item) => !('uploadedByUserId' in item)),
      ).toBe(true);
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

    it('preserves existing PDF on disk when DB save fails during replace', async () => {
      const originalFile = createValidPdfMulterFile(
        'polityka-v1.pdf',
        '%PDF-1.7\noriginal-content\n%%EOF',
      );
      await service.upsertDocument('privacyPolicy', originalFile, {}, 1);
      mockRepository.save.mockRejectedValueOnce(new Error('DB write failure'));
      const replacementFile = createValidPdfMulterFile(
        'polityka-v2.pdf',
        '%PDF-1.7\nreplacement-content\n%%EOF',
      );
      await expect(
        service.upsertDocument('privacyPolicy', replacementFile, {}, 1),
      ).rejects.toThrow('DB write failure');
      const diskBytes = await readFile(join(tempDir, 'polityka-prywatnosci.pdf'));
      expect(diskBytes.equals(originalFile.buffer)).toBe(true);
      const filesInDir = await readdir(tempDir);
      expect(filesInDir).toEqual(['polityka-prywatnosci.pdf']);
    });

    it('rejects non-PDF content without %PDF- magic header', async () => {
      const fakeFile = createValidPdfMulterFile('fake.pdf', 'not a pdf file');
      await expect(
        service.upsertDocument('termsOfUse', fakeFile, {}, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when reading file of unuploaded document or orphan disk file', async () => {
      await expect(service.getDocumentFile('documentation')).rejects.toThrow(
        NotFoundException,
      );
      await writeFile(
        join(tempDir, 'dokumentacja.pdf'),
        Buffer.from('%PDF-1.7\norphan\n%%EOF', 'utf8'),
      );
      await expect(service.getDocumentFile('documentation')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deleteDocument', () => {
    it('deletes uploaded PDF file from disk and database', async () => {
      const inputFile = createValidPdfMulterFile('warunki.pdf');
      await service.upsertDocument('termsOfUse', inputFile, {}, 1);
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

