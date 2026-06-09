import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Request } from 'express';

import { BacklogService } from './backlog-service';
import { BacklogEntity } from '../database/entities/backlog.entity';
import { GroupEntity } from '../database/entities/group.entity';
import { EnrollmentEntity } from '../database/entities/enrollment.entity';
import { AuthTokenSessionService } from '../auth/api-token/auth-token-session-service';
import { UserRolesService } from '../user-roles/user-roles-service';
import { GROUP_RESPONSE_GROUP_ID_OFFSET } from '../constants/group-api-constants';

describe('BacklogService', () => {
      let service: BacklogService;
      let backlogRepository: any;
      let groupRepository: any;
      let enrollmentRepository: any;
      let authTokenSessionService: any;
      let userRolesService: any;

           beforeEach(async () => {
                   backlogRepository = {
                             find: jest.fn(),
                   };
                   groupRepository = {
                             exist: jest.fn(),
                   };
                   enrollmentRepository = {
                             exist: jest.fn(),
                   };
                   authTokenSessionService = {
                             resolveSubjectStrongFromRequest: jest.fn(),
                   };
                   userRolesService = {
                             findAccountIdForRole: jest.fn(),
                             resolvePrimaryRoleForUser: jest.fn(),
                   };

                          const module: TestingModule = await Test.createTestingModule({
                                    providers: [
                                                BacklogService,
                                        {
                                                      provide: getRepositoryToken(BacklogEntity),
                                                      useValue: backlogRepository,
                                        },
                                        {
                                                      provide: getRepositoryToken(GroupEntity),
                                                      useValue: groupRepository,
                                        },
                                        {
                                                      provide: getRepositoryToken(EnrollmentEntity),
                                                      useValue: enrollmentRepository,
                                        },
                                        {
                                                      provide: AuthTokenSessionService,
                                                      useValue: authTokenSessionService,
                                        },
                                        {
                                                      provide: UserRolesService,
                                                      useValue: userRolesService,
                                        },
                                              ],
                          }).compile();

                          service = module.get<BacklogService>(BacklogService);
           });

           describe('getStudentBacklog', () => {
                   it('should return error if unauthorized', async () => {
                             // Arrange
                            authTokenSessionService.resolveSubjectStrongFromRequest.mockResolvedValue(null);

                            // Act
                            const result = await service.getStudentBacklog({} as Request, 1, 'browser-id', undefined, 50, 0);

                            // Assert
                            expect(result).toEqual({ error: 'Unauthorized' });
                   });

                        it('should return error if student account not found', async () => {
                                  // Arrange
                                 authTokenSessionService.resolveSubjectStrongFromRequest.mockResolvedValue({ userId: 1 });
                                  userRolesService.resolvePrimaryRoleForUser.mockResolvedValue('student');
                                  userRolesService.findAccountIdForRole.mockResolvedValue(null);

                                 // Act
                                 const result = await service.getStudentBacklog({} as Request, 1, 'browser-id', undefined, 50, 0);

                                 // Assert
                                 expect(result).toEqual({ error: 'Forbidden: Student account not found' });
                        });

                        it('should return error if student is not enrolled', async () => {
                                  // Arrange
                                 authTokenSessionService.resolveSubjectStrongFromRequest.mockResolvedValue({ userId: 1 });
                                  userRolesService.resolvePrimaryRoleForUser.mockResolvedValue('student');
                                  userRolesService.findAccountIdForRole.mockResolvedValue(10);
                                  enrollmentRepository.exist.mockResolvedValue(false);

                                 // Act
                                 const publicGroupId = GROUP_RESPONSE_GROUP_ID_OFFSET + 5;
                                  const result = await service.getStudentBacklog({} as Request, publicGroupId, 'browser-id', undefined, 50, 0);

                                 // Assert
                                 expect(result).toEqual({ error: 'Forbidden: You are not enrolled in this group' });
                        });

                        it('should return backlog items for valid student', async () => {
                                  // Arrange
                                 const publicGroupId = GROUP_RESPONSE_GROUP_ID_OFFSET + 5;
                                  const internalGroupId = 5;
                                  const studentAccountId = 10;
                                  const mockDate = new Date();

                                 authTokenSessionService.resolveSubjectStrongFromRequest.mockResolvedValue({ userId: 1 });
                                  userRolesService.resolvePrimaryRoleForUser.mockResolvedValue('student');
                                  userRolesService.findAccountIdForRole.mockResolvedValue(studentAccountId);
                                  enrollmentRepository.exist.mockResolvedValue(true);

                                 const mockEntries = [
                                     { id: 1, groupId: internalGroupId, accountId: studentAccountId, type: 'SHOP_PURCHASE', date: mockDate, value: 'item_1' },
                                           ];
                                  backlogRepository.find.mockResolvedValue(mockEntries);

                                 // Act
                                 const result = await service.getStudentBacklog({} as Request, publicGroupId, 'browser-id', undefined, 50, 0);

                                 // Assert
                                 expect(backlogRepository.find).toHaveBeenCalledWith({
                                             where: { groupId: internalGroupId, accountId: studentAccountId },
                                             order: { date: 'DESC' },
                                             take: 50,
                                             skip: 0,
                                 });
                                  expect(result).toEqual([
                                      { id: 1, type: 'SHOP_PURCHASE', date: mockDate.toISOString(), value: 'item_1', accountId: studentAccountId },
                                            ]);
                        });
           });

           describe('getGroupBacklog', () => {
                   it('should return error if unauthorized', async () => {
                             // Arrange
                            authTokenSessionService.resolveSubjectStrongFromRequest.mockResolvedValue(null);

                            // Act
                            const publicGroupId = GROUP_RESPONSE_GROUP_ID_OFFSET + 1;
                             const result = await service.getGroupBacklog({} as Request, publicGroupId, 'browser-id', undefined, 50, 0);

                            // Assert
                            expect(result).toEqual({ error: 'Unauthorized' });
                   });

                        it('should return error if user role does not have privileges', async () => {
                                  // Arrange
                                 authTokenSessionService.resolveSubjectStrongFromRequest.mockResolvedValue({ userId: 1 });
                                  userRolesService.resolvePrimaryRoleForUser.mockResolvedValue('student');

                                 // Act
                                 const publicGroupId = GROUP_RESPONSE_GROUP_ID_OFFSET + 1;
                                  const result = await service.getGroupBacklog({} as Request, publicGroupId, 'browser-id', undefined, 50, 0);

                                 // Assert
                                 expect(result).toEqual({ error: 'Forbidden: Requires privileges' });
                        });

                        it('should return error if lecturer does not own the group', async () => {
                                  // Arrange
                                 const publicGroupId = GROUP_RESPONSE_GROUP_ID_OFFSET + 5;

                                 authTokenSessionService.resolveSubjectStrongFromRequest.mockResolvedValue({ userId: 1 });
                                  userRolesService.resolvePrimaryRoleForUser.mockResolvedValue('lecturer');
                                  userRolesService.findAccountIdForRole.mockResolvedValue(10);
                                  groupRepository.exist.mockResolvedValue(false);

                                 // Act
                                 const result = await service.getGroupBacklog({} as Request, publicGroupId, 'browser-id', undefined, 50, 0);

                                 // Assert
                                 expect(result).toEqual({ error: 'Forbidden: You are not the owner of this group' });
                        });

                        it('should return group backlog items for valid lecturer', async () => {

                                 // Arrange
                                 const publicGroupId = GROUP_RESPONSE_GROUP_ID_OFFSET + 5;
                                  const internalGroupId = 5;
                                  const mockDate = new Date();

                                 authTokenSessionService.resolveSubjectStrongFromRequest.mockResolvedValue({ userId: 1 });
                                  userRolesService.resolvePrimaryRoleForUser.mockResolvedValue('lecturer');
                                  userRolesService.findAccountIdForRole.mockResolvedValue(10);
                                  groupRepository.exist.mockResolvedValue(true);

                                 const mockEntries = [
                                     { id: 1, groupId: internalGroupId, accountId: 10, type: 'SHOP_PURCHASE', date: mockDate, value: 'item_1' },
                                           ];
                                  backlogRepository.find.mockResolvedValue(mockEntries);

                                 // Act
                                 const result = await service.getGroupBacklog({} as Request, publicGroupId, 'browser-id', undefined, 50, 0);

                                 // Assert
                                 expect(groupRepository.exist).toHaveBeenCalledWith({
                                             where: { id: internalGroupId, teacherAccountId: 10 },
                                 });
                                  expect(result).toEqual([
                                      { id: 1, type: 'SHOP_PURCHASE', date: mockDate.toISOString(), value: 'item_1', accountId: 10 },
                                            ]);
                        });
           });
});
