import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { GroupTemplateEntity } from '../../database/entities/group-template.entity';
import { GroupTemplatesCrudService } from './group-templates-crud-service';

describe('GroupTemplatesCrudService', () => {
  let service: GroupTemplatesCrudService;
  let repo: Repository<GroupTemplateEntity>;

  let mockQueryBuilder: any;

  beforeEach(async () => {
    mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
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
          },
        },
      ],
    }).compile();

    service = module.get<GroupTemplatesCrudService>(GroupTemplatesCrudService);
    repo = module.get<Repository<GroupTemplateEntity>>(getRepositoryToken(GroupTemplateEntity));
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
        [{ id: 1, name: 'T1', createdAt: new Date() }],
        1,
      ]);
      const result = await service.getTemplates(5, 'public', 20, 5);

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('t.is_public = true');
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(20);
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(5);
      expect(result.total).toBe(1);
      expect(result.items.length).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.offset).toBe(5);
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
});
