import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Request } from 'express';

import { AuthTokenSessionService } from '../auth/api-token/auth-token-session-service';
import { UserRolesService } from '../user-roles/user-roles-service';
import { BacklogEntity } from '../database/entities/backlog.entity';
import { GroupEntity } from '../database/entities/group.entity';
import { EnrollmentEntity } from '../database/entities/enrollment.entity';
import { STUDENT_ROLE_NAME, LECTURER_ROLE_NAME, ADMINISTRATOR_ROLE_NAME, SUPER_ROLE_NAME } from '../constants/role-name-constants';
import { GROUP_RESPONSE_GROUP_ID_OFFSET, toInternalGroupId } from '../constants/group-api-constants';

export type BacklogItemResponse = {
      id: number;
      type: string;
      date: string;
      value: string | null;
      accountId: number;
};

@Injectable()
    export class BacklogService {
      constructor(
              @InjectRepository(BacklogEntity)
              private readonly backlogRepository: Repository<BacklogEntity>,
              @InjectRepository(GroupEntity)
              private readonly groupRepository: Repository<GroupEntity>,
              @InjectRepository(EnrollmentEntity)
              private readonly enrollmentRepository: Repository<EnrollmentEntity>,
              private readonly authTokenSessionService: AuthTokenSessionService,
              private readonly userRolesService: UserRolesService,
            ) {}

  public async getStudentBacklog(
          req: Request,
          publicGroupId: number,
          browserIdHeader: string | undefined,
          authHeader: string | undefined,
          take: number,
          skip: number,
        ): Promise<BacklogItemResponse[] | { error: string }> {
          const groupId = toInternalGroupId(publicGroupId);

        const subject = await this.authTokenSessionService.getSubjectAndGroupFromRequest(req, browserIdHeader, authHeader);
          if (!subject) {
                    return { error: 'Forbidden: Requires privilege' };
          }

        const primaryRole = subject.primaryRole;
          if (primaryRole !== STUDENT_ROLE_NAME) {
                    return { error: 'Forbidden: Requires student role' };
          }

        const studentAccountId = await this.userRolesService.findAccountIdForRole(subject.userId, STUDENT_ROLE_NAME);
          if (!studentAccountId) {
                    return { error: 'Forbidden: Student account not found' };
          }

        const isEnrolled = await this.enrollmentRepository.exist({
                  where: {
                              groupId,
                              accountId: studentAccountId,
                  },
        });

        if (!isEnrolled) {
                  return { error: 'Forbidden: You are not enrolled in this group' };
        }

        const items = await this.backlogRepository.find({
                  where: {
                              groupId,
                              accountId: studentAccountId,
                  },
                  order: {
                              date: 'DESC',
                  },
                  take,
                  skip,
        });

        return items.map((item) => ({
                  id: item.id,
                  type: item.type ?? '',
                  date: item.date ? item.date.toISOString() : '',
                  value: item.value,
                  accountId: item.accountId ?? 0,
        }));
  }

  public async getGroupBacklog(
          req: Request,
          publicGroupId: number,
          browserIdHeader: string | undefined,
          authHeader: string | undefined,
          take: number,
          skip: number,
        ): Promise<BacklogItemResponse[] | { error: string }> {
          const groupId = toInternalGroupId(publicGroupId);

        const subject = await this.authTokenSessionService.getSubjectAndGroupFromRequest(req, browserIdHeader, authHeader);
          if (!subject) {
                    return { error: 'Forbidden: Requires privilege' };
          }

        const primaryRole = subject.primaryRole;
          if (primaryRole !== SUPER_ROLE_NAME) {
                    const accountId = await this.userRolesService.findAccountIdForRole(subject.userId, primaryRole!);
                    if (!accountId) {
                                return { error: 'Forbidden: Requires privileges' };
                    }

            if (primaryRole === LECTURER_ROLE_NAME) {
                        const isOwner = await this.groupRepository.exist({
                                      where: {
                                                      id: groupId,
                                                      lecturerId: accountId,
                                      },
                        });
                        if (!isOwner) {
                                      return { error: 'Forbidden: You are not the owner of this group' };
                        }
            } else if (primaryRole !== ADMINISTRATOR_ROLE_NAME) {
                        return { error: 'Forbidden: Requires privileges' };
            }
          }

        const items = await this.backlogRepository.find({
                  where: {
                              groupId,
                  },
                  order: {
                              date: 'DESC',
                  },
                  take,
                  skip,
        });

        return items.map((item) => ({
                  id: item.id,
                  type: item.type ?? '',
                  date: item.date ? item.date.toISOString() : '',
                  value: item.value,
                  accountId: item.accountId ?? 0,
        }));
  }
}
