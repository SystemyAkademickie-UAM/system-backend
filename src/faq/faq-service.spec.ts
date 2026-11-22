import { NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';

import { DEFAULT_FAQ_CATEGORY } from '../constants/faq-constants';
import type { FaqEntity } from '../database/entities/faq.entity';
import { FaqService } from './faq-service';

function createMockFaqEntity(override?: Partial<FaqEntity>): FaqEntity {
  return {
    id: 1,
    question: 'Jak zacząć?',
    answer: 'Wystarczy się zalogować...',
    category: DEFAULT_FAQ_CATEGORY,
    orderIndex: 0,
    isPublished: true,
    createdByUserId: 10,
    updatedByUserId: 10,
    createdAt: new Date('2026-11-01T12:00:00Z'),
    updatedAt: new Date('2026-11-01T12:00:00Z'),
    ...override,
  } as FaqEntity;
}

describe('FaqService', () => {
  let mockRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    manager?: {
      transaction: jest.Mock;
    };
  };
  let service: FaqService;

  beforeEach(() => {
    mockRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      manager: {
        transaction: jest.fn(async (cb) =>
          cb({ getRepository: () => mockRepository }),
        ),
      },
    };
    service = new FaqService(mockRepository as unknown as Repository<FaqEntity>);
  });

  describe('listAdminFaqs', () => {
    it('returns all FAQ items ordered by orderIndex and id', async () => {
      const mockEntities = [
        createMockFaqEntity({ id: 1 }),
        createMockFaqEntity({ id: 2 }),
      ];
      mockRepository.find.mockResolvedValue(mockEntities);
      const actual = await service.listAdminFaqs();
      expect(actual).toHaveLength(2);
      expect(actual[0].id).toBe(1);
    });

    it('passes category and search filter to repository', async () => {
      mockRepository.find.mockResolvedValue([]);
      await service.listAdminFaqs({ category: 'Konto', search: 'hasło' });
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: expect.objectContaining({ category: 'Konto' }),
        order: { orderIndex: 'ASC', id: 'ASC' },
      });
    });
  });

  describe('getFaqById', () => {
    it('returns FAQ entry when found', async () => {
      const mockEntity = createMockFaqEntity({ id: 42 });
      mockRepository.findOne.mockResolvedValue(mockEntity);
      const actual = await service.getFaqById(42);
      expect(actual.id).toBe(42);
    });

    it('throws NotFoundException when entry does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      await expect(service.getFaqById(999)).rejects.toThrow(NotFoundException);
    });

    it('queries published-only when publishedOnly option is true', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      await expect(
        service.getFaqById(77, { publishedOnly: true }),
      ).rejects.toThrow(NotFoundException);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 77, isPublished: true },
      });
    });
  });

  describe('createFaq', () => {
    it('creates and saves FAQ entry with provided and default values', async () => {
      const mockEntity = createMockFaqEntity({ id: 5 });
      mockRepository.create.mockReturnValue(mockEntity);
      mockRepository.save.mockResolvedValue(mockEntity);
      const actual = await service.createFaq(
        { question: 'Pytanie?', answer: 'Odpowiedź.' },
        10,
      );
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          question: 'Pytanie?',
          answer: 'Odpowiedź.',
          category: DEFAULT_FAQ_CATEGORY,
          orderIndex: 0,
          isPublished: true,
          createdByUserId: 10,
        }),
      );
      expect(actual.id).toBe(5);
    });
  });

  describe('updateFaq', () => {
    it('updates existing FAQ entry and saves changes', async () => {
      const existing = createMockFaqEntity({ id: 7, question: 'Stare?' });
      mockRepository.findOne.mockResolvedValue(existing);
      mockRepository.save.mockImplementation(async (record) => record);
      const actual = await service.updateFaq(
        7,
        { question: 'Nowe?', isPublished: false },
        15,
      );
      expect(actual.question).toBe('Nowe?');
      expect(actual.isPublished).toBe(false);
      expect(actual.updatedByUserId).toBe(15);
    });

    it('throws NotFoundException when updating non-existent FAQ', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      await expect(
        service.updateFaq(999, { question: 'Czy istnieje?' }, 10),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('replaceAllFaqs', () => {
    it('replaces existing FAQ entries inside a transaction with new page items', async () => {
      mockRepository.find.mockResolvedValue([createMockFaqEntity({ id: 1 })]);
      mockRepository.delete.mockResolvedValue({ affected: 1 });
      const createdEntity = createMockFaqEntity({
        id: 2,
        question: 'Nowe pytanie?',
        answer: 'Nowa odpowiedź.',
      });
      mockRepository.create.mockReturnValue(createdEntity);
      mockRepository.save.mockResolvedValue([createdEntity]);
      const actual = await service.replaceAllFaqs(
        {
          items: [{ question: 'Nowe pytanie?', answer: 'Nowa odpowiedź.' }],
        },
        10,
      );
      expect(mockRepository.manager?.transaction).toHaveBeenCalled();
      expect(mockRepository.delete).toHaveBeenCalledWith([1]);
      expect(actual).toHaveLength(1);
      expect(actual[0].question).toBe('Nowe pytanie?');
    });
  });

  describe('deleteFaq', () => {
    it('deletes entry and returns confirmation', async () => {
      const existing = createMockFaqEntity({ id: 12 });
      mockRepository.findOne.mockResolvedValue(existing);
      mockRepository.delete.mockResolvedValue({ affected: 1 });
      const actual = await service.deleteFaq(12);
      expect(actual).toEqual({ deleted: true, id: 12 });
      expect(mockRepository.delete).toHaveBeenCalledWith({ id: 12 });
    });

    it('throws NotFoundException when deleting non-existent FAQ', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      await expect(service.deleteFaq(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('reorderFaqs', () => {
    it('updates order indices for batch items inside a transaction and returns refreshed list', async () => {
      const items = [
        createMockFaqEntity({ id: 1, orderIndex: 1 }),
        createMockFaqEntity({ id: 2, orderIndex: 0 }),
      ];
      mockRepository.update.mockResolvedValue({ affected: 1 });
      mockRepository.find.mockResolvedValue(items);
      const actual = await service.reorderFaqs(
        { items: [{ id: 1, orderIndex: 1 }, { id: 2, orderIndex: 0 }] },
        20,
      );
      expect(mockRepository.manager?.transaction).toHaveBeenCalled();
      expect(mockRepository.update).toHaveBeenCalledTimes(2);
      expect(actual).toHaveLength(2);
    });
  });

  describe('listPublicFaqs, getPublicFaqById & listGroupedPublicFaqs', () => {
    it('lists only published FAQ entries ordered by orderIndex without internal user IDs', async () => {
      const mockEntities = [createMockFaqEntity({ id: 1, isPublished: true })];
      mockRepository.find.mockResolvedValue(mockEntities);
      const actual = await service.listPublicFaqs('Ogólne');
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { isPublished: true, category: 'Ogólne' },
        order: { orderIndex: 'ASC', id: 'ASC' },
      });
      expect(actual).toHaveLength(1);
      expect('createdByUserId' in actual[0]).toBe(false);
      expect('updatedByUserId' in actual[0]).toBe(false);
    });

    it('retrieves single published FAQ without internal user IDs', async () => {
      mockRepository.findOne.mockResolvedValue(createMockFaqEntity({ id: 9 }));
      const actual = await service.getPublicFaqById(9);
      expect(actual.id).toBe(9);
      expect('createdByUserId' in actual).toBe(false);
      expect('updatedByUserId' in actual).toBe(false);
    });

    it('groups published FAQs by category', async () => {
      const mockEntities = [
        createMockFaqEntity({ id: 1, category: 'Konto', question: 'Hasło?' }),
        createMockFaqEntity({ id: 2, category: 'Konto', question: 'Email?' }),
        createMockFaqEntity({ id: 3, category: 'Sklep', question: 'Ceny?' }),
      ];
      mockRepository.find.mockResolvedValue(mockEntities);
      const actual = await service.listGroupedPublicFaqs();
      expect(actual).toHaveLength(2);
      expect(actual[0].category).toBe('Konto');
      expect(actual[0].items).toHaveLength(2);
      expect(actual[1].category).toBe('Sklep');
      expect(actual[1].items).toHaveLength(1);
    });
  });
});
