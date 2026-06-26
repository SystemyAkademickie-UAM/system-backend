import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { GroupTemplateFavoriteEntity } from '../../database/entities/group-template-favorite.entity';
import { GroupTemplateEntity } from '../../database/entities/group-template.entity';
import { GroupTemplatesCrudService } from './group-templates-crud-service';

describe('GroupTemplatesCrudService', () => {
  let service: GroupTemplatesCrudService;
  let repo: Repository<GroupTemplateEntity>;
  let favoritesRepo: Repository<GroupTemplateFavoriteEntity>;

  let mockQueryBuilder: any;
  let mockFavoritesQueryBuilder: any;
  let mockAccountQueryBuilder: any;

  beforeEach(async () => {
    mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
    };

    mockFavoritesQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };

    mockAccountQueryBuilder = {
      createQueryBuilder: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupTemplatesCrudService,
        {
          provide: getRepositoryToken(GroupTemplateEntity),
          useValue: {
            createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
            findOne: jest.fn(),
            save: jest.fn().mockImplementation((entity: any) => Promise.resolve(entity)),
            delete: jest.fn().mockResolvedValue({ affected: 1 }),
            create: jest.fn().mockImplementation((entity: any) => entity),
            manager: {
              getRepository: jest.fn().mockReturnValue(mockAccountQueryBuilder),
            },
          },
        },
        {
          provide: getRepositoryToken(GroupTemplateFavoriteEntity),
          useValue: {
            createQueryBuilder: jest.fn().mockReturnValue(mockFavoritesQueryBuilder),
            findOne: jest.fn(),
            save: jest.fn().mockResolvedValue(undefined),
            delete: jest.fn().mockResolvedValue({ affected: 1 }),
            create: jest.fn().mockImplementation((entity: any) => entity),
          },
        },
      ],
    }).compile();

    service = module.get<GroupTemplatesCrudService>(GroupTemplatesCrudService);
    repo = module.get<Repository<GroupTemplateEntity>>(getRepositoryToken(GroupTemplateEntity));
    favoritesRepo = module.get<Repository<GroupTemplateFavoriteEntity>>(
      getRepositoryToken(GroupTemplateFavoriteEntity),
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getTemplates', () => {
    it('should query correctly for my scope', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);
      await service.getTemplates(5, 'my', 10, 0);

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('t.creator_account_id = :accountId', { accountId: 5 });
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
    });

    it('should query correctly for public scope', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([
        [{ id: 1, name: 'T1', createdAt: new Date(), creatorAccountId: 2 }],
        1,
      ]);
      mockAccountQueryBuilder.getRawMany.mockResolvedValue([
        { accountId: 2, nickname: 'Mentor', name: 'Jan', surname: 'Kowalski', showNickname: true },
      ]);
      const result = await service.getTemplates(5, 'public', 20, 5);

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('t.is_public = :isPublic', { isPublic: true });
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(20);
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(5);
      expect(result.total).toBe(1);
      expect(result.items.length).toBe(1);
      expect(result.items[0].isOwn).toBe(false);
      expect(result.items[0].creatorNickname).toBe('Mentor');
      expect(result.items[0].creatorDisplayName).toBe('Mentor (Jan Kowalski)');
      expect(result.items[0].creatorLegalName).toBe('Jan Kowalski');
      expect(result.limit).toBe(20);
      expect(result.offset).toBe(5);
    });

    it('should mark own templates and favorites for public scope', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([
        [{ id: 1, name: 'T1', createdAt: new Date(), description: null, isPublic: true, creatorAccountId: 5, baseGroupId: null }],
        1,
      ]);
      mockFavoritesQueryBuilder.getRawMany.mockResolvedValue([{ templateId: 1 }]);
      mockAccountQueryBuilder.getRawMany.mockResolvedValue([
        { accountId: 5, nickname: 'Ja', name: 'Anna', surname: 'Nowak', showNickname: true },
      ]);

      const result = await service.getTemplates(5, 'public', 20, 0);

      expect(mockQueryBuilder.leftJoin).not.toHaveBeenCalled();
      expect(result.items[0].isFavorite).toBe(true);
      expect(result.items[0].isOwn).toBe(true);
      expect(result.items[0].creatorNickname).toBe('Ja');
    });

    it('should filter to favorites only for public scope', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.getTemplates(5, 'public', 20, 0, true);

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('t.is_public = :isPublic', { isPublic: true });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
      expect(mockQueryBuilder.innerJoin).not.toHaveBeenCalled();
    });
  });

  describe('getTemplateDetails', () => {
    it('should return template if public', async () => {
      jest.spyOn(repo, 'findOne').mockResolvedValue({ id: 1, isPublic: true, creatorAccountId: 10 } as any);
      const res = await service.getTemplateDetails(1, 5);
      expect(res.id).toBe(1);
    });

    it('should return template if private but caller is creator', async () => {
      jest.spyOn(repo, 'findOne').mockResolvedValue({ id: 1, isPublic: false, creatorAccountId: 5 } as any);
      const res = await service.getTemplateDetails(1, 5);
      expect(res.id).toBe(1);
    });

    it('should throw ForbiddenException if private and not creator', async () => {
      jest.spyOn(repo, 'findOne').mockResolvedValue({ id: 1, isPublic: false, creatorAccountId: 10 } as any);
      await expect(service.getTemplateDetails(1, 5)).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if not exists', async () => {
      jest.spyOn(repo, 'findOne').mockResolvedValue(null);
      await expect(service.getTemplateDetails(1, 5)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateTemplate', () => {
    it('should throw ForbiddenException if not creator', async () => {
      jest.spyOn(repo, 'findOne').mockResolvedValue({ id: 1, creatorAccountId: 10 } as any);
      await expect(service.updateTemplate(1, 5, { name: 'A' })).rejects.toThrow(ForbiddenException);
    });

    it('should save updates if creator', async () => {
      const template = { id: 1, name: 'Old', creatorAccountId: 5 } as any;
      jest.spyOn(repo, 'findOne').mockResolvedValue(template);
      const saveSpy = jest.spyOn(repo, 'save');

      const res = await service.updateTemplate(1, 5, { name: 'New', isPublic: true });
      expect(res.name).toBe('New');
      expect(res.isPublic).toBe(true);
      expect(saveSpy).toHaveBeenCalledWith(template);
    });
  });

  describe('deleteTemplate', () => {
    it('should throw ForbiddenException if not creator', async () => {
      jest.spyOn(repo, 'findOne').mockResolvedValue({ id: 1, creatorAccountId: 10 } as any);
      await expect(service.deleteTemplate(1, 5)).rejects.toThrow(ForbiddenException);
    });

    it('should delete if creator', async () => {
      jest.spyOn(repo, 'findOne').mockResolvedValue({ id: 1, creatorAccountId: 5 } as any);
      const deleteSpy = jest.spyOn(repo, 'delete');

      await service.deleteTemplate(1, 5);
      expect(deleteSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('setTemplateFavorite', () => {
    it('should throw NotFoundException when template missing', async () => {
      jest.spyOn(repo, 'findOne').mockResolvedValue(null);
      await expect(service.setTemplateFavorite(1, 5, true)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for private template', async () => {
      jest.spyOn(repo, 'findOne').mockResolvedValue({ id: 1, isPublic: false } as any);
      await expect(service.setTemplateFavorite(1, 5, true)).rejects.toThrow(ForbiddenException);
    });

    it('should save favorite for public template', async () => {
      jest.spyOn(repo, 'findOne').mockResolvedValue({ id: 1, isPublic: true } as any);
      jest.spyOn(favoritesRepo, 'findOne').mockResolvedValue(null);
      const saveSpy = jest.spyOn(favoritesRepo, 'save');

      await service.setTemplateFavorite(1, 5, true);

      expect(saveSpy).toHaveBeenCalled();
    });

    it('should delete favorite when unset', async () => {
      jest.spyOn(repo, 'findOne').mockResolvedValue({ id: 1, isPublic: true } as any);
      const deleteSpy = jest.spyOn(favoritesRepo, 'delete');

      await service.setTemplateFavorite(1, 5, false);

      expect(deleteSpy).toHaveBeenCalledWith({ accountId: 5, templateId: 1 });
    });
  });
});
