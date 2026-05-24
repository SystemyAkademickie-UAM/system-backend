import { Body, Controller, Delete, Headers, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Req, Get, Query } from '@nestjs/common';
import type { Request } from 'express';

import { toInternalGroupId } from '../constants/group-api-constants';

import { BadgesService } from '../gamification/badges-service';
import { CreateBadgeDto } from '../gamification/dto/create-badge.dto';
import { UpdateBadgeDto } from '../gamification/dto/update-badge.dto';
import { CreateRankDto } from '../gamification/dto/create-rank.dto';
import { UpdateRankDto } from '../gamification/dto/update-rank.dto';
import { RanksService } from '../gamification/ranks-service';
import { CreateGroupBodyDto } from './dto/create-group-body.dto';
import { EnrollGroupBodyDto } from './dto/enroll-group-body.dto';
import { GenerateCodeBodyDto } from './dto/generate-code-body.dto';
import { JoinGroupQueryDto } from './dto/join-group-query.dto';
import { EnrollGroupResponseBody, GroupsEnrollmentService } from './groups-enrollment-service';
import { CreateGroupResponseBody, GenerateCodeResponseBody, GetGroupsCatalogResponseBody, GetUserGroupsResponseBody, GroupPreviewResponseBody, GroupsService } from './groups-service';

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
   * Returns groups for the authenticated user (student enrollments and lecturer-owned groups).
   * Auth: `maq_auth` cookie or optional `auth` query param. Requires `X-Browser-ID` for strong binding.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  getUserGroups(
    @Req() req: Request,
    @Headers('x-browser-id') browserId: string | undefined,
    @Query('auth') auth: string | undefined,
  ): Promise<GetUserGroupsResponseBody> {
    return this.groupsService.getUserGroups(req, browserId, auth);
  }

  /**
   * Returns all groups split into `myGroups` and `otherGroups` for the authenticated user.
   * GET /groups/catalog
   */
  @Get('catalog')
  @HttpCode(HttpStatus.OK)
  getGroupsCatalog(
    @Req() req: Request,
    @Headers('x-browser-id') browserId: string | undefined,
    @Query('auth') auth: string | undefined,
  ): Promise<GetGroupsCatalogResponseBody> {
    return this.groupsService.getGroupsCatalog(req, browserId, auth);
  }

  /**
   * Returns public group metadata and access flags for the authenticated user.
   * GET /groups/:groupId/preview
   */
  @Get(':groupId/preview')
  @HttpCode(HttpStatus.OK)
  getGroupPreview(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Req() req: Request,
    @Headers('x-browser-id') browserId: string | undefined,
    @Query('auth') auth: string | undefined,
  ): Promise<GroupPreviewResponseBody> {
    return this.groupsService.getGroupPreview(req, publicGroupId, browserId, auth);
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
   * Returns the current entry code for a group owned by the lecturer.
   * GET /groups/:groupId/access-code
   */
  @Get(':groupId/access-code')
  @HttpCode(HttpStatus.OK)
  getAccessCode(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Req() req: Request,
    @Headers('x-browser-id') browserId: string | undefined,
    @Query('auth') auth: string | undefined,
  ): Promise<GenerateCodeResponseBody> {
    return this.groupsService.getAccessCodeForGroup(req, publicGroupId, browserId, auth);
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
   * Validates entry code for a group and enrolls the student when auth succeeds.
   * Auth is read from `maq_auth` cookie OR query `auth` parameter.
   */
  @Get(':groupId/invite')
  joinGroup(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Req() req: Request,
    @Headers('x-browser-id') browserId: string | undefined,
    @Query() query: JoinGroupQueryDto,
  ): Promise<EnrollGroupResponseBody> {
    return this.groupsEnrollmentService.enrollStudentByCode(req, publicGroupId, query, browserId);
  }

  // ========================================
  // BADGES CRUD
  // ========================================

  /**
   * Returns all badges for the given course group.
   * GET /groups/:groupId/badges
   */
  @Get(':groupId/badges')
  @HttpCode(HttpStatus.OK)
  getBadges(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Req() req: Request,
    @Query('auth') auth: string | undefined,
  ) {
    return this.badgesService.getBadgesForGroup(req, toInternalGroupId(publicGroupId), auth);
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
   * Updates a badge definition.
   * PATCH /groups/:groupId/badges/:badgeId
   */
  @Patch(':groupId/badges/:badgeId')
  @HttpCode(HttpStatus.OK)
  updateBadge(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Param('badgeId', ParseIntPipe) badgeId: number,
    @Req() req: Request,
    @Body() dto: UpdateBadgeDto,
  ) {
    return this.badgesService.updateBadge(req, toInternalGroupId(publicGroupId), badgeId, dto);
  }

  /**
   * Deletes a badge definition.
   * DELETE /groups/:groupId/badges/:badgeId
   */
  @Delete(':groupId/badges/:badgeId')
  @HttpCode(HttpStatus.OK)
  deleteBadge(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Param('badgeId', ParseIntPipe) badgeId: number,
    @Req() req: Request,
    @Body() body: { auth?: string },
  ) {
    return this.badgesService.deleteBadge(req, toInternalGroupId(publicGroupId), badgeId, body?.auth);
  }

  // ========================================
  // RANKS CRUD
  // ========================================

  /**
   * Returns all ranks for the given course group.
   * GET /groups/:groupId/ranks
   */
  @Get(':groupId/ranks')
  @HttpCode(HttpStatus.OK)
  getRanks(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Req() req: Request,
    @Query('auth') auth: string | undefined,
  ) {
    return this.ranksService.getRanksForGroup(req, toInternalGroupId(publicGroupId), auth);
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

  /**
   * Updates a rank definition.
   * PATCH /groups/:groupId/ranks/:rankId
   */
  @Patch(':groupId/ranks/:rankId')
  @HttpCode(HttpStatus.OK)
  updateRank(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Param('rankId', ParseIntPipe) rankId: number,
    @Req() req: Request,
    @Body() dto: UpdateRankDto,
  ) {
    return this.ranksService.updateRank(req, toInternalGroupId(publicGroupId), rankId, dto);
  }

  /**
   * Deletes a rank definition.
   * DELETE /groups/:groupId/ranks/:rankId
   */
  @Delete(':groupId/ranks/:rankId')
  @HttpCode(HttpStatus.OK)
  deleteRank(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Param('rankId', ParseIntPipe) rankId: number,
    @Req() req: Request,
    @Body() body: { auth?: string },
  ) {
    return this.ranksService.deleteRank(req, toInternalGroupId(publicGroupId), rankId, body?.auth);
  }
}
