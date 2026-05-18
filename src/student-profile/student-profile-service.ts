import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { Repository } from 'typeorm';

import { AuthTokenSessionService } from '../auth/api-token/auth-token-session-service';
import { STUDENT_ROLE_NAME } from '../constants/role-name-constants';
import { EnrollmentEntity } from '../database/entities/enrollment.entity';
import { GroupEntity } from '../database/entities/group.entity';
import { UserRolesService } from '../user-roles/user-roles-service';
import { GROUP_RESPONSE_GROUP_ID_OFFSET } from '../constants/group-api-constants';

@Injectable()
export class StudentProfileService {
  constructor(
    private readonly authTokenSessionService: AuthTokenSessionService,
    private readonly userRolesService: UserRolesService,
    @InjectRepository(EnrollmentEntity)
    private readonly enrollmentRepository: Repository<EnrollmentEntity>,
    @InjectRepository(GroupEntity)
    private readonly groupRepository: Repository<GroupEntity>,
  ) {}

  async getStudentProfile(req: Request, publicGroupId: number, browserIdHeader: string | undefined) {
    const subject = await this.authTokenSessionService.resolveSubjectStrongFromRequest(
      req,
      browserIdHeader,
      undefined,
    );
    if (!subject) {
      return { error: 'Unauthorized' };
    }

    const studentAccountId = await this.userRolesService.findAccountIdForRole(subject.userId, STUDENT_ROLE_NAME);
    if (studentAccountId === null) {
      return { error: 'Brak profilu studenta dla tego użytkownika' };
    }

    const groupId =
      publicGroupId >= GROUP_RESPONSE_GROUP_ID_OFFSET
        ? publicGroupId - GROUP_RESPONSE_GROUP_ID_OFFSET
        : publicGroupId;

    const enrollment = await this.enrollmentRepository.findOne({
      where: { groupId, studentAccountId },
    });

    if (!enrollment) {
      return { error: 'Student nie jest zapisany do tej grupy' };
    }

    const group = await this.groupRepository.findOne({
      where: { id: groupId },
    });

    if (!group) {
      return { error: 'Grupa nie istnieje' };
    }

    return {
      studentAccountId: enrollment.studentAccountId,
      groupId: publicGroupId,
      lives: group.lives,
      currency: group.currency,
      currencyIcon: group.currencyIcon,
      livesIcon: group.livesIcon,
    };
  }
}
