import { Body, Controller, Headers, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Req } from '@nestjs/common';
import type { Request } from 'express';

import { toInternalGroupId } from '../constants/group-api-constants';

import { BadgesService } from '../gamification/badges-service';
import { CreateBadgeDto } from '../gamification/dto/create-badge.dto';
import { CreateRankDto } from '../gamification/dto/create-rank.dto';
import { RanksService } from '../gamification/ranks-service';
import { CreateGroupBodyDto } from './dto/create-group-body.dto';
import { EnrollGroupBodyDto } from './dto/enroll-group-body.dto';
import { EnrollGroupResponseBody, GroupsEnrollmentService } from './groups-enrollment-service';
import { CreateGroupResponseBody, GroupsService } from './groups-service';

/**
 * Course group creation API for lecturers.
 */
@Controller('groups')
export class GroupsController {
  constructor(
    private readonly groupsService: GroupsService,
    private readonly groupsEnrollmentService: GroupsEnrollmentService,
    private readonly badgesService: BadgesService,
    private readonly ranksService: RanksService,
  ) {}

  /**
   * Creates a group row when the caller presents a valid lecturer-bound session.
   * Auth is read from `maq_auth` cookie OR body `auth` field.
   */
  @Post('new')
  @HttpCode(HttpStatus.OK)
  createGroup(
    @Req() req: Request,
    @Headers('x-browser-id') browserId: string | undefined,
    @Body() body: CreateGroupBodyDto,
  ): Promise<CreateGroupResponseBody> {
    return this.groupsService.createGroup(req, body, browserId);
  }

  /**
   * Records student enrollment in `gamification.enrollments` after invite validation (handled elsewhere).
   * Auth is read from `maq_auth` cookie OR body `auth` field.
   */
  @Post(':id/enroll')
  @HttpCode(HttpStatus.OK)
  enrollInGroup(
    @Param('id', ParseIntPipe) groupId: number,
    @Req() req: Request,
    @Headers('x-browser-id') browserId: string | undefined,
    @Body() body: EnrollGroupBodyDto,
  ): Promise<EnrollGroupResponseBody> {
    return this.groupsEnrollmentService.enrollStudentInGroup(req, groupId, body, browserId);
  }

  /**
   * Creates a badge definition for the given course group.
   * POST /groups/:groupId/badges
   */
  @Post(':groupId/badges')
  @HttpCode(HttpStatus.CREATED)
  createBadge(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Body() dto: CreateBadgeDto,
  ) {
    return this.badgesService.createBadge(toInternalGroupId(publicGroupId), dto);
  }

  /**
   * Creates a rank definition for the given course group.
   * POST /groups/:groupId/ranks
   */
  @Post(':groupId/ranks')
  @HttpCode(HttpStatus.CREATED)
  createRank(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Body() dto: CreateRankDto,
  ) {
    return this.ranksService.createRank(toInternalGroupId(publicGroupId), dto);
  }
}
