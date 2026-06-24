import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Request } from 'express';

import { SessionService, type SessionSubject } from '../auth/session/session.service';
import { EnrollmentEntity } from '../database/entities/enrollment.entity';
import { GroupEntity } from '../database/entities/group.entity';
import { PostEntity } from '../database/entities/post.entity';
import { UserRolesService } from '../user-roles/user-roles-service';
import { GroupsPostsService } from './groups-posts-service';

function mockSubject(userId: number): SessionSubject {
  return { userId, activeRole: null, sessionId: 1 };
}

describe('GroupsPostsService', () => {
  let service: GroupsPostsService;
  let sessionService: jest.Mocked<SessionService>;
  let userRolesService: jest.Mocked<UserRolesService>;
  let groupRepository: Record<string, jest.Mock>;
  let enrollmentRepository: Record<string, jest.Mock>;
  let postRepository: Record<string, jest.Mock>;

  const mockRequest = {} as Request;

  beforeEach(async () => {
    groupRepository = { exist: jest.fn() };
    enrollmentRepository = { exist: jest.fn() };
    postRepository = {
      create: jest.fn((data) => data),
      save: jest.fn((entity) => Promise.resolve({ ...entity, id: 1 })),
      find: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupsPostsService,
        {
          provide: SessionService,
          useValue: { resolveSubjectFromRequest: jest.fn() },
        },
        {
          provide: UserRolesService,
          useValue: { findAccountIdForRole: jest.fn() },
        },
        { provide: getRepositoryToken(GroupEntity), useValue: groupRepository },
        { provide: getRepositoryToken(EnrollmentEntity), useValue: enrollmentRepository },
        { provide: getRepositoryToken(PostEntity), useValue: postRepository },
      ],
    }).compile();

    service = module.get<GroupsPostsService>(GroupsPostsService);
    sessionService = module.get(SessionService);
    userRolesService = module.get(UserRolesService);
  });

  describe('createPost', () => {
    it('should create a post with isPublished false and createdAt from body', async () => {
      sessionService.resolveSubjectFromRequest.mockResolvedValue(mockSubject(1));
      userRolesService.findAccountIdForRole.mockResolvedValue(10);
      groupRepository.exist.mockResolvedValue(true);

      const result = await service.createPost(mockRequest, 1, {
        title: 'Test',
        content: 'Hello',
        createdAt: '2026-06-15T20:00:00.000Z',
      });

      expect(result.post).toBe(1);
      expect(postRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          isPublished: false,
          publishedAt: null,
        }),
      );
      const createArg = postRepository.create.mock.calls[0][0];
      expect(createArg.createdAt).toEqual(new Date('2026-06-15T20:00:00.000Z'));
    });

    it('should default createdAt to now() when not provided', async () => {
      sessionService.resolveSubjectFromRequest.mockResolvedValue(mockSubject(1));
      userRolesService.findAccountIdForRole.mockResolvedValue(10);
      groupRepository.exist.mockResolvedValue(true);

      const before = new Date();
      await service.createPost(mockRequest, 1, {
        title: 'Test',
        content: 'Hello',
      });
      const after = new Date();

      const createArg = postRepository.create.mock.calls[0][0];
      expect(createArg.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(createArg.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('getPosts', () => {
    it('should return all posts for lecturer (including unpublished)', async () => {
      sessionService.resolveSubjectFromRequest.mockResolvedValue(mockSubject(1));
      userRolesService.findAccountIdForRole.mockImplementation(async (_userId, role) => {
        if (role === 'lecturer') return 10;
        return null;
      });
      groupRepository.exist.mockResolvedValue(true);
      postRepository.find.mockResolvedValue([
        { id: 1, title: 'Published', content: 'x', isPublished: true, createdAt: new Date(), publishedAt: new Date() },
        { id: 2, title: 'Draft', content: 'y', isPublished: false, createdAt: new Date(), publishedAt: null },
      ]);

      const result = await service.getPosts(mockRequest, 1);

      expect(result.posts).toHaveLength(2);
      expect(postRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ groupId: 1 }),
        }),
      );
      const whereArg = postRepository.find.mock.calls[0][0].where;
      expect(whereArg).not.toHaveProperty('isPublished');
    });

    it('should return only published posts for students', async () => {
      sessionService.resolveSubjectFromRequest.mockResolvedValue(mockSubject(1));
      userRolesService.findAccountIdForRole.mockImplementation(async (_userId, role) => {
        if (role === 'student') return 20;
        return null;
      });
      enrollmentRepository.exist.mockResolvedValue(true);
      postRepository.find.mockResolvedValue([]);

      await service.getPosts(mockRequest, 1);

      const whereArg = postRepository.find.mock.calls[0][0].where;
      expect(whereArg).toHaveProperty('isPublished', true);
    });

    it('should include new fields in response', async () => {
      sessionService.resolveSubjectFromRequest.mockResolvedValue(mockSubject(1));
      userRolesService.findAccountIdForRole.mockImplementation(async (_userId, role) => {
        if (role === 'lecturer') return 10;
        return null;
      });
      groupRepository.exist.mockResolvedValue(true);
      const now = new Date('2026-06-15T12:00:00.000Z');
      postRepository.find.mockResolvedValue([
        { id: 1, title: 'T', content: 'C', isPublished: true, createdAt: now, publishedAt: now },
      ]);

      const result = await service.getPosts(mockRequest, 1);

      expect(result.posts[0]).toEqual(expect.objectContaining({
        isPublished: true,
        createdAt: '2026-06-15T12:00:00.000Z',
        publishedAt: '2026-06-15T12:00:00.000Z',
      }));
    });
  });

  describe('updatePost — publishing workflow', () => {
    beforeEach(() => {
      sessionService.resolveSubjectFromRequest.mockResolvedValue(mockSubject(1));
      userRolesService.findAccountIdForRole.mockResolvedValue(10);
      groupRepository.exist.mockResolvedValue(true);
      postRepository.update.mockResolvedValue({ affected: 1 });
    });

    it('should auto-set publishedAt to current date when isPublished is set to true', async () => {
      const before = new Date();
      await service.updatePost(mockRequest, 1, 42, { isPublished: true });
      const after = new Date();

      const updateArg = postRepository.update.mock.calls[0][1];
      expect(updateArg.isPublished).toBe(true);
      expect(updateArg.publishedAt).toBeInstanceOf(Date);
      expect(updateArg.publishedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(updateArg.publishedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should reset publishedAt to null when isPublished is set to false', async () => {
      await service.updatePost(mockRequest, 1, 42, { isPublished: false });

      const updateArg = postRepository.update.mock.calls[0][1];
      expect(updateArg.isPublished).toBe(false);
      expect(updateArg.publishedAt).toBeNull();
    });

    it('should not touch publishedAt when isPublished is not provided', async () => {
      await service.updatePost(mockRequest, 1, 42, { title: 'New title' });

      const updateArg = postRepository.update.mock.calls[0][1];
      expect(updateArg).not.toHaveProperty('isPublished');
      expect(updateArg).not.toHaveProperty('publishedAt');
    });
  });
});
