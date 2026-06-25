import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';

import { GroupEntity } from '../../database/entities/group.entity';
import { GroupTemplateEntity } from '../../database/entities/group-template.entity';
import { GroupTemplatesImportService } from './group-templates-import-service';

describe('GroupTemplatesImportService', () => {
  let service: GroupTemplatesImportService;
  let mockManager: any;
  let mockDataSource: any;

  beforeEach(async () => {
    mockManager = {
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((entityClass: any, dto: any) => ({ ...dto, id: Math.floor(Math.random() * 1000) })),
      save: jest.fn().mockImplementation((entityClass: any, entity: any) => Promise.resolve(entity)),
      query: jest.fn().mockResolvedValue([]),
    };

    mockDataSource = {
      transaction: jest.fn().mockImplementation(async (cb) => {
        return cb(mockManager);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupTemplatesImportService,
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<GroupTemplatesImportService>(GroupTemplatesImportService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should throw NotFoundException if template does not exist', async () => {
    mockManager.findOne.mockResolvedValue(null);

    await expect(service.createGroupFromTemplate(999, 1, 'New Group')).rejects.toThrow(NotFoundException);
  });

  it('should throw ForbiddenException if template is private and caller is not creator', async () => {
    mockManager.findOne.mockResolvedValue({
      id: 1,
      isPublic: false,
      creatorAccountId: 10, // Not 1
      data: { group: {} },
    });

    await expect(service.createGroupFromTemplate(1, 1, 'New Group')).rejects.toThrow(ForbiddenException);
  });

  it('should allow import if template is public and caller is not creator', async () => {
    mockManager.findOne.mockResolvedValue({
      id: 1,
      isPublic: true,
      creatorAccountId: 10, // Not 1
      data: {
        group: { name: 'Old', subjectName: 'Subj' },
      },
    });

    const result = await service.createGroupFromTemplate(1, 1, 'New Group', 'New Subj');
    expect(result).toBeDefined();
    expect(result.teacherAccountId).toBe(1);
    expect(result.name).toBe('New Group');
    expect(result.subjectName).toBe('New Subj');
  });

  it('should remap FKs successfully on full import', async () => {
    mockManager.findOne.mockResolvedValue({
      id: 1,
      isPublic: false,
      creatorAccountId: 1,
      data: {
        group: { name: 'Base', subjectName: 'Subj' },
        badges: [{ id: 100, name: 'Badge1' }],
        ranks: [{ id: 200, name: 'Rank1' }],
        itemCategories: [{ id: 300, name: 'Cat1' }],
        items: [
          {
            id: 400,
            categoryId: 300,
            name: 'Item1',
            listing: {
              basePrice: 10,
              rankPromotions: [{ rankId: 200, promotionType: 'fixed', value: 5 }],
              badgePromotions: [{ badgeId: 100, promotionType: 'fixed', value: 2 }],
            },
          },
        ],
        stages: [
          {
            id: 500,
            name: 'Stage1',
            activities: [{ name: 'Act1', currency: 10 }],
          },
        ],
        posts: [{ title: 'Post1', content: 'Content1' }],
      },
    });

    // We can intercept the saved entities to check their IDs
    let savedGroupId = 0;
    let savedBadgeId = 0;
    let savedRankId = 0;
    let savedCatId = 0;
    let savedItemId = 0;
    let savedListingId = 0;

    mockManager.create.mockImplementation((entityClass: any, dto: any) => {
      // Mock deterministic IDs for testing FK mapping
      let id = 1000;
      if (entityClass.name === 'GroupEntity') id = 1001;
      if (entityClass.name === 'BadgeEntity') id = 1002;
      if (entityClass.name === 'RankEntity') id = 1003;
      if (entityClass.name === 'ItemCategoryEntity') id = 1004;
      if (entityClass.name === 'ItemEntity') id = 1005;
      if (entityClass.name === 'ShopListingEntity') id = 1006;
      if (entityClass.name === 'StageEntity') id = 1007;
      if (entityClass.name === 'ActivityEntity') id = 1008;
      if (entityClass.name === 'PostEntity') id = 1009;

      return { ...dto, id };
    });

    mockManager.save.mockImplementation((entityClass: any, entity: any) => {
      if (entityClass.name === 'GroupEntity') savedGroupId = entity.id;
      if (entityClass.name === 'BadgeEntity') savedBadgeId = entity.id;
      if (entityClass.name === 'RankEntity') savedRankId = entity.id;
      if (entityClass.name === 'ItemCategoryEntity') savedCatId = entity.id;
      if (entityClass.name === 'ItemEntity') savedItemId = entity.id;
      if (entityClass.name === 'ShopListingEntity') savedListingId = entity.id;
      return Promise.resolve(entity);
    });

    await service.createGroupFromTemplate(1, 1, 'My Group');

    // Verify correct calls
    expect(mockManager.save).toHaveBeenCalled();

    // Verify Item Entity received the NEW mapped category ID
    const itemSaveCall = mockManager.save.mock.calls.find((call: any) => call[0].name === 'ItemEntity');
    expect(itemSaveCall[1].categoryId).toBe(savedCatId);
    expect(itemSaveCall[1].groupId).toBe(savedGroupId);

    // Verify Shop Listing Rank Promotions raw query used NEW rank ID and NEW listing ID
    const rankQueryCall = mockManager.query.mock.calls.find((call: any) => call[0].includes('shop_listing_rank_promotions'));
    expect(rankQueryCall).toBeDefined();
    expect(rankQueryCall[1][0]).toBe(savedListingId);
    expect(rankQueryCall[1][1]).toBe(savedRankId);

    // Verify Shop Listing Badge Promotions raw query used NEW badge ID and NEW listing ID
    const badgeQueryCall = mockManager.query.mock.calls.find((call: any) => call[0].includes('shop_listing_badge_promotions'));
    expect(badgeQueryCall).toBeDefined();
    expect(badgeQueryCall[1][0]).toBe(savedListingId);
    expect(badgeQueryCall[1][1]).toBe(savedBadgeId);
  });
});
