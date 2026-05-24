import { Body, Controller, Headers, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Req, Get, Query } from '@nestjs/common';
import type { Request } from 'express';

import { toInternalGroupId } from '../constants/group-api-constants';

import { BadgesService } from '../gamification/badges-service';
import { CreateBadgeDto } from '../gamification/dto/create-badge.dto';
import { CreateRankDto } from '../gamification/dto/create-rank.dto';
import { RanksService } from '../gamification/ranks-service';
import { CreateGroupBodyDto } from './dto/create-group-body.dto';
import { EnrollGroupBodyDto } from './dto/enroll-group-body.dto';
import { GenerateCodeBodyDto } from './dto/generate-code-body.dto';
import { JoinGroupQueryDto } from './dto/join-group-query.dto';
import { EnrollGroupResponseBody, GroupsEnrollmentService } from './groups-enrollment-service';
import { CreateGroupResponseBody, GetUserGroupsResponseBody, GenerateCodeResponseBody, GroupsService } from './groups-service';

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
   * Returns a list of groups the user belongs to (with mapped lecturer data).
   * Auth is read from `maq_auth` cookie OR header `x-browser-id`.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  getUserGroups(
    @Req() req: Request,
    @Headers('x-browser-id') browserId: string | undefined,
  ): Promise<GetUserGroupsResponseBody> {
    return this.groupsService.getUserGroups(req, browserId);
  }

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
   * Generates a 6-character entry code and persists it on `education.groups.entry_code`.
   * Auth is read from `maq_auth` cookie OR body `auth` field. Lecturer must own the group.
   */
  @Post('generate-code')
  @HttpCode(HttpStatus.OK)
  generateCode(
    @Req() req: Request,
    @Headers('x-browser-id') browserId: string | undefined,
    @Body() body: GenerateCodeBodyDto,
  ): Promise<GenerateCodeResponseBody> {
    return this.groupsService.generateCodeForGroup(req, body, browserId);
  }

  /**
   * Enrolls a student in a group when the entry code matches that specific group.
   * Auth is read from `maq_auth` cookie OR query `auth` parameter.
   */
  @Get(':groupId/invite')
  joinGroup(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Req() req: Request,
    @Headers('x-browser-id') browserId: string | undefined,
    @Query() query: JoinGroupQueryDto,
  ) {
    return this.groupsEnrollmentService.enrollStudentByCode(req, publicGroupId, query, browserId);
  }

  /**
   * Creates a badge definition for the given course group.
   * Auth is read from `maq_auth` cookie OR body `auth` field (soft token resolution).
   * POST /groups/:groupId/badges
   */
  @Post(':groupId/badges')
  @HttpCode(HttpStatus.CREATED)
  createBadge(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Req() req: Request,
    @Body() dto: CreateBadgeDto,
  ) {
    return this.badgesService.createBadge(req, toInternalGroupId(publicGroupId), dto);
  }

  /**
   * Creates a rank definition for the given course group.
   * Auth is read from `maq_auth` cookie OR body `auth` field (soft token resolution).
   * POST /groups/:groupId/ranks
   */
  @Post(':groupId/ranks')
  @HttpCode(HttpStatus.CREATED)
  createRank(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Req() req: Request,
    @Body() dto: CreateRankDto,
  ) {
    return this.ranksService.createRank(req, toInternalGroupId(publicGroupId), dto);
  }
}
