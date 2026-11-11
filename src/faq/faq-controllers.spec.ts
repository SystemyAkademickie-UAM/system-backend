import type { Request } from 'express';

import { AdminFaqController } from './admin-faq-controller';
import { FaqAccessService } from './faq-access-service';
import { FaqController } from './faq-controller';
import type {
  FaqGroupedCategoryResponse,
  FaqItemResponse,
} from './faq-response-types';
import { FaqService } from './faq-service';

function createMockResponse(id: number): FaqItemResponse {
  return {
    id,
    question: `Pytanie ${id}`,
    answer: `Odpowiedź ${id}`,
    category: 'Ogólne',
    orderIndex: 0,
    isPublished: true,
    createdByUserId: 1,
    updatedByUserId: 1,
    createdAt: '2026-11-01T12:00:00.000Z',
    updatedAt: '2026-11-01T12:00:00.000Z',
  };
}

describe('FaqControllers', () => {
  let mockFaqService: {
    listAdminFaqs: jest.Mock;
    getFaqById: jest.Mock;
    getPublicFaqById: jest.Mock;
    createFaq: jest.Mock;
    replaceAllFaqs: jest.Mock;
    updateFaq: jest.Mock;
    reorderFaqs: jest.Mock;
    deleteFaq: jest.Mock;
    listPublicFaqs: jest.Mock;
    listGroupedPublicFaqs: jest.Mock;
  };
  let mockAccessService: {
    resolveSuperAdminUserId: jest.Mock;
  };
  let adminController: AdminFaqController;
  let publicController: FaqController;

  beforeEach(() => {
    mockFaqService = {
      listAdminFaqs: jest.fn(),
      getFaqById: jest.fn(),
      getPublicFaqById: jest.fn(),
      createFaq: jest.fn(),
      replaceAllFaqs: jest.fn(),
      updateFaq: jest.fn(),
      reorderFaqs: jest.fn(),
      deleteFaq: jest.fn(),
      listPublicFaqs: jest.fn(),
      listGroupedPublicFaqs: jest.fn(),
    };
    mockAccessService = {
      resolveSuperAdminUserId: jest.fn().mockResolvedValue(100),
    };
    adminController = new AdminFaqController(
      mockFaqService as unknown as FaqService,
      mockAccessService as unknown as FaqAccessService,
    );
    publicController = new FaqController(
      mockFaqService as unknown as FaqService,
    );
  });

  describe('AdminFaqController', () => {
    it('list delegates to faqService.listAdminFaqs', async () => {
      mockFaqService.listAdminFaqs.mockResolvedValue([createMockResponse(1)]);
      const actual = await adminController.list('Ogólne', 'search');
      expect(actual).toHaveLength(1);
      expect(mockFaqService.listAdminFaqs).toHaveBeenCalledWith({
        category: 'Ogólne',
        search: 'search',
      });
    });

    it('getOne delegates to faqService.getFaqById', async () => {
      mockFaqService.getFaqById.mockResolvedValue(createMockResponse(2));
      const actual = await adminController.getOne(2);
      expect(actual.id).toBe(2);
    });

    it('create resolves superAdminUserId and calls faqService.createFaq', async () => {
      mockFaqService.createFaq.mockResolvedValue(createMockResponse(3));
      const actual = await adminController.create({} as Request, {
        question: 'Q?',
        answer: 'A.',
      });
      expect(mockAccessService.resolveSuperAdminUserId).toHaveBeenCalled();
      expect(mockFaqService.createFaq).toHaveBeenCalledWith(
        { question: 'Q?', answer: 'A.' },
        100,
      );
      expect(actual.id).toBe(3);
    });

    it('replaceAll resolves superAdminUserId and calls faqService.replaceAllFaqs', async () => {
      mockFaqService.replaceAllFaqs.mockResolvedValue([createMockResponse(1)]);
      const actual = await adminController.replaceAll({} as Request, {
        items: [{ question: 'Q?', answer: 'A.' }],
      });
      expect(mockAccessService.resolveSuperAdminUserId).toHaveBeenCalled();
      expect(mockFaqService.replaceAllFaqs).toHaveBeenCalledWith(
        { items: [{ question: 'Q?', answer: 'A.' }] },
        100,
      );
      expect(actual).toHaveLength(1);
    });

    it('update resolves superAdminUserId and calls faqService.updateFaq', async () => {
      mockFaqService.updateFaq.mockResolvedValue(createMockResponse(4));
      const actual = await adminController.update(4, {} as Request, {
        question: 'Updated?',
      });
      expect(mockAccessService.resolveSuperAdminUserId).toHaveBeenCalled();
      expect(mockFaqService.updateFaq).toHaveBeenCalledWith(
        4,
        { question: 'Updated?' },
        100,
      );
      expect(actual.id).toBe(4);
    });

    it('reorder delegates to faqService.reorderFaqs', async () => {
      mockFaqService.reorderFaqs.mockResolvedValue([createMockResponse(1)]);
      const actual = await adminController.reorder({} as Request, {
        items: [{ id: 1, orderIndex: 0 }],
      });
      expect(actual).toHaveLength(1);
    });

    it('delete delegates to faqService.deleteFaq', async () => {
      mockFaqService.deleteFaq.mockResolvedValue({ deleted: true, id: 5 });
      const actual = await adminController.delete(5);
      expect(actual).toEqual({ deleted: true, id: 5 });
    });
  });

  describe('FaqController', () => {
    it('list delegates to listPublicFaqs when grouped is unset', async () => {
      mockFaqService.listPublicFaqs.mockResolvedValue([createMockResponse(1)]);
      const actual = await publicController.list('Konto', undefined);
      expect(actual).toHaveLength(1);
      expect(mockFaqService.listPublicFaqs).toHaveBeenCalledWith('Konto');
    });

    it('list delegates to listGroupedPublicFaqs when grouped is true', async () => {
      const groupedData: FaqGroupedCategoryResponse[] = [
        { category: 'Ogólne', items: [createMockResponse(1)] },
      ];
      mockFaqService.listGroupedPublicFaqs.mockResolvedValue(groupedData);
      const actual = await publicController.list(undefined, 'true');
      expect(actual).toEqual(groupedData);
      expect(mockFaqService.listGroupedPublicFaqs).toHaveBeenCalled();
    });

    it('getOne delegates to getPublicFaqById', async () => {
      mockFaqService.getPublicFaqById.mockResolvedValue(createMockResponse(10));
      const actual = await publicController.getOne(10);
      expect(actual.id).toBe(10);
      expect(mockFaqService.getPublicFaqById).toHaveBeenCalledWith(10);
    });
  });
});
