import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';

import {
  PATCH_NOTES_STORAGE_DIR_ENV,
} from '../constants/patch-notes-constants';
import type { PatchNoteEntity } from '../database/entities/patch-note.entity';
import { PatchNotesService } from './patch-notes-service';

function createValidPdfMulterFile(
  filename = 'changelog-1.0.pdf',
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

describe('PatchNotesService', () => {
  let tempDir: string;
  let mockRepository: {
    create: jest.Mock;
    save: jest.Mock;
    findAndCount: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    delete: jest.Mock;
  };
  let service: PatchNotesService;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'maq-patch-notes-test-'));
    process.env[PATCH_NOTES_STORAGE_DIR_ENV] = tempDir;
    mockRepository = {
      create: jest.fn((data: Partial<PatchNoteEntity>) => ({ ...data })),
      save: jest.fn(async (entity: Partial<PatchNoteEntity>) => ({
        id: 10,
        createdAt: new Date('2026-11-03T10:00:00.000Z'),
        ...entity,
      })),
      findAndCount: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      delete: jest.fn(),
    };
    service = new PatchNotesService(
      mockRepository as unknown as Repository<PatchNoteEntity>,
    );
  });

  afterEach(async () => {
    delete process.env[PATCH_NOTES_STORAGE_DIR_ENV];
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('createPatchNote', () => {
    it('stores a valid PDF on disk and saves metadata in database', async () => {
      const inputFile = createValidPdfMulterFile('update-v2.pdf');
      const actual = await service.createPatchNote(
        inputFile,
        { title: 'Update 2.0', version: 'v2.0.0' },
        1,
      );
      expect(actual).toEqual({
        id: 10,
        title: 'Update 2.0',
        version: 'v2.0.0',
        originalFilename: 'update-v2.pdf',
        fileSizeBytes: inputFile.buffer.length,
        uploadedByUserId: 1,
        createdAt: '2026-11-03T10:00:00.000Z',
        fileUrl: '/api/patch-notes/10/file',
      });
      const storedFiles = await readdir(tempDir);
      expect(storedFiles).toHaveLength(1);
      expect(storedFiles[0]).toMatch(/\.pdf$/);
    });

    it('derives default title from filename when title is omitted', async () => {
      const inputFile = createValidPdfMulterFile('patch-notes-november.pdf');
      const actual = await service.createPatchNote(inputFile, {}, 5);
      expect(actual.title).toBe('patch-notes-november');
      expect(actual.version).toBeNull();
    });

    it('throws BadRequestException when file is missing or empty', async () => {
      await expect(
        service.createPatchNote(undefined, { title: 'Missing' }, 1),
      ).rejects.toThrow(BadRequestException);
      const emptyFile = createValidPdfMulterFile('empty.pdf', '');
      await expect(
        service.createPatchNote(emptyFile, { title: 'Empty' }, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when file does not start with %PDF- magic bytes', async () => {
      const fakePdf = createValidPdfMulterFile(
        'malicious.pdf',
        '<html><script>alert(1)</script></html>',
      );
      await expect(
        service.createPatchNote(fakePdf, { title: 'Fake' }, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('cleans up stored file from disk if database save fails', async () => {
      mockRepository.save.mockRejectedValueOnce(new Error('DB failure'));
      const inputFile = createValidPdfMulterFile('rollback.pdf');
      await expect(
        service.createPatchNote(inputFile, { title: 'Rollback' }, 1),
      ).rejects.toThrow('DB failure');
      const remainingFiles = await readdir(tempDir);
      expect(remainingFiles).toHaveLength(0);
    });
  });

  describe('listPatchNotes', () => {
    it('returns paginated list ordered newest first', async () => {
      mockRepository.findAndCount.mockResolvedValue([
        [
          {
            id: 2,
            title: 'Patch 1.1',
            version: '1.1',
            originalFilename: 'p1.1.pdf',
            storageKey: '11111111-1111-4111-8111-111111111111.pdf',
            fileSizeBytes: 512,
            uploadedByUserId: 1,
            createdAt: new Date('2026-11-03T12:00:00.000Z'),
          },
        ],
        1,
      ]);
      const actual = await service.listPatchNotes(20, 0);
      expect(actual.total).toBe(1);
      expect(actual.items[0]?.fileUrl).toBe('/api/patch-notes/2/file');
      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        order: { createdAt: 'DESC', id: 'DESC' },
        take: 20,
        skip: 0,
      });
    });
  });

  describe('getLatestPatchNote & getPatchNoteFileById', () => {
    it('reads stored PDF file bytes by patch note id', async () => {
      const inputFile = createValidPdfMulterFile('release-notes.pdf');
      let capturedStorageKey = '';
      mockRepository.save.mockImplementationOnce(async (entity: PatchNoteEntity) => {
        capturedStorageKey = entity.storageKey;
        return {
          ...entity,
          id: 25,
          createdAt: new Date('2026-11-03T10:00:00.000Z'),
        };
      });
      await service.createPatchNote(inputFile, { title: 'Release' }, 1);
      mockRepository.findOne.mockResolvedValueOnce({
        id: 25,
        title: 'Release',
        version: null,
        originalFilename: 'release-notes.pdf',
        storageKey: capturedStorageKey,
        fileSizeBytes: inputFile.buffer.length,
        uploadedByUserId: 1,
        createdAt: new Date('2026-11-03T10:00:00.000Z'),
      });
      const filePayload = await service.getPatchNoteFileById(25);
      expect(filePayload.filename).toBe('release-notes.pdf');
      expect(filePayload.contentType).toBe('application/pdf');
      expect(filePayload.buffer.equals(inputFile.buffer)).toBe(true);
    });

    it('throws NotFoundException when patch note id does not exist', async () => {
      mockRepository.findOne.mockResolvedValueOnce(null);
      await expect(service.getPatchNoteFileById(999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when no patch notes exist for getLatestPatchNote', async () => {
      mockRepository.find.mockResolvedValueOnce([]);
      await expect(service.getLatestPatchNote()).rejects.toThrow(NotFoundException);
    });
  });

  describe('deletePatchNote', () => {
    it('deletes record from DB and removes file from disk', async () => {
      const inputFile = createValidPdfMulterFile('to-delete.pdf');
      let capturedStorageKey = '';
      mockRepository.save.mockImplementationOnce(async (entity: PatchNoteEntity) => {
        capturedStorageKey = entity.storageKey;
        return {
          ...entity,
          id: 33,
          createdAt: new Date('2026-11-03T10:00:00.000Z'),
        };
      });
      await service.createPatchNote(inputFile, { title: 'Delete me' }, 1);
      mockRepository.findOne.mockResolvedValueOnce({
        id: 33,
        storageKey: capturedStorageKey,
      });
      mockRepository.delete.mockResolvedValueOnce({ affected: 1 });
      const result = await service.deletePatchNote(33);
      expect(result).toEqual({ deleted: true });
      const filesAfterDelete = await readdir(tempDir);
      expect(filesAfterDelete).toHaveLength(0);
    });

    it('throws NotFoundException when deleting non-existent patch note', async () => {
      mockRepository.findOne.mockResolvedValueOnce(null);
      await expect(service.deletePatchNote(404)).rejects.toThrow(NotFoundException);
    });
  });
});

