import { Body, Controller, Delete, Headers, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Req, Get, Query } from '@nestjs/common';
import type { Request } from 'express';

import { toInternalGroupId } from '../constants/group-api-constants';

import { CreateBadgeDto } from '../gamification/dto/create-badge.dto';
import { CreateItemCategoryDto } from '../gamification/dto/create-item-category.dto';
import { CreateShopItemDto } from '../gamification/dto/create-shop-item.dto';
import { CreateShopItemFromTemplateDto } from '../gamification/dto/create-shop-item-from-template.dto';
import { UpdateBadgeDto } from '../gamification/dto/update-badge.dto';
import { UpdateItemCategoryDto } from '../gamification/dto/update-item-category.dto';
import { UpdateShopItemDto } from '../gamification/dto/update-shop-item.dto';
import { CreateRankDto } from '../gamification/dto/create-rank.dto';
import { UpdateRankDto } from '../gamification/dto/update-rank.dto';
import { BadgesService } from '../gamification/badges-service';
import { ItemCategoriesService } from '../gamification/item-categories-service';
import { ShopItemsService } from '../gamification/shop-items-service';
import { ShopStudentService } from '../gamification/shop-student-service';
import { RanksService } from '../gamification/ranks-service';
import { CreateEnrollmentCodeDto } from './dto/create-enrollment-code.dto';
import { CreateGroupBodyDto } from './dto/create-group-body.dto';
import { EnrollGroupBodyDto } from './dto/enroll-group-body.dto';
import { GenerateCodeBodyDto } from './dto/generate-code-body.dto';
import { JoinGroupQueryDto } from './dto/join-group-query.dto';
import { UpdateEnrollmentCodeDto } from './dto/update-enrollment-code.dto';
import { UpdateGroupBodyDto } from './dto/update-group-body.dto';
import { UpdateShopStatusDto } from './dto/update-shop-status.dto';
import { EnrollmentCodesService } from './enrollment-codes-service';
import { EnrollGroupResponseBody, GroupsEnrollmentService } from './groups-enrollment-service';
import { CreateGroupResponseBody, GenerateCodeResponseBody, GetGroupsCatalogResponseBody, GetUserGroupsResponseBody, GroupPreviewResponseBody, GroupsService, UpdateGroupResponseBody } from './groups-service';

/**
 * Course group creation API for lecturers.
 */
@Controller('groups')
export class GroupsController {
  constructor(
    private readonly groupsService: GroupsService,
    private readonly groupsEnrollmentService: GroupsEnrollmentService,
    private readonly badgesService: BadgesService,
    private readonly itemCategoriesService: ItemCategoriesService,
    private readonly shopItemsService: ShopItemsService,
    private readonly shopStudentService: ShopStudentService,
    private readonly ranksService: RanksService,
    private readonly enrollmentCodesService: EnrollmentCodesService,
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
   * Updates an existing group owned by the authenticated lecturer.
   * PATCH /groups/:groupId
   */
  @Patch(':groupId')
  @HttpCode(HttpStatus.OK)
  updateGroup(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Req() req: Request,
    @Headers('x-browser-id') browserId: string | undefined,
    @Body() body: UpdateGroupBodyDto,
  ): Promise<UpdateGroupResponseBody> {
    return this.groupsService.updateGroup(req, publicGroupId, body, browserId);
  }

  /**
   * Updates the shop open/closed status for the group.
   * PATCH /groups/:groupId/shop-status
   */
  @Patch(':groupId/shop-status')
  @HttpCode(HttpStatus.OK)
  updateShopStatus(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Req() req: Request,
    @Headers('x-browser-id') browserId: string | undefined,
    @Body() body: UpdateShopStatusDto,
  ) {
    return this.groupsService.updateShopStatus(req, publicGroupId, body, browserId);
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
   * Generates a new enrollment code via the enrollment codes API.
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

  /**
   * Lists enrollment codes for a lecturer-owned group.
   */
  @Get(':groupId/enrollment-codes')
  @HttpCode(HttpStatus.OK)
  listEnrollmentCodes(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Req() req: Request,
    @Query('auth') auth: string | undefined,
  ) {
    return this.enrollmentCodesService.listCodesForGroup(req, toInternalGroupId(publicGroupId), auth);
  }

  /**
   * Returns a single enrollment code by id.
   */
  @Get(':groupId/enrollment-codes/:codeId')
  @HttpCode(HttpStatus.OK)
  getEnrollmentCode(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Param('codeId', ParseIntPipe) codeId: number,
    @Req() req: Request,
    @Query('auth') auth: string | undefined,
  ) {
    return this.enrollmentCodesService.getCodeForGroup(req, toInternalGroupId(publicGroupId), codeId, auth);
  }

  /**
   * Creates an enrollment code with optional expiration and usage limits.
   */
  @Post(':groupId/enrollment-codes')
  @HttpCode(HttpStatus.CREATED)
  createEnrollmentCode(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Req() req: Request,
    @Body() dto: CreateEnrollmentCodeDto,
  ) {
    return this.enrollmentCodesService.createCode(req, toInternalGroupId(publicGroupId), dto);
  }

  /**
   * Updates enrollment code limits or active flag.
   */
  @Patch(':groupId/enrollment-codes/:codeId')
  @HttpCode(HttpStatus.OK)
  updateEnrollmentCode(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Param('codeId', ParseIntPipe) codeId: number,
    @Req() req: Request,
    @Body() dto: UpdateEnrollmentCodeDto,
  ) {
    return this.enrollmentCodesService.updateCode(req, toInternalGroupId(publicGroupId), codeId, dto);
  }

  /**
   * Deletes an enrollment code.
   */
  @Delete(':groupId/enrollment-codes/:codeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteEnrollmentCode(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Param('codeId', ParseIntPipe) codeId: number,
    @Req() req: Request,
    @Query('auth') auth: string | undefined,
  ): Promise<void> {
    await this.enrollmentCodesService.deleteCode(req, toInternalGroupId(publicGroupId), codeId, auth);
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
  // SHOP ITEM CATEGORIES CRUD
  // ========================================

  /**
   * Returns all shop item categories for the given course group.
   * GET /groups/:groupId/item-categories
   */
  @Get(':groupId/item-categories')
  @HttpCode(HttpStatus.OK)
  getItemCategories(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Req() req: Request,
    @Query('auth') auth: string | undefined,
  ) {
    return this.itemCategoriesService.getCategoriesForGroup(req, toInternalGroupId(publicGroupId), auth);
  }

  /**
   * Creates a shop item category for the given course group.
   * POST /groups/:groupId/item-categories
   */
  @Post(':groupId/item-categories')
  @HttpCode(HttpStatus.CREATED)
  createItemCategory(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Req() req: Request,
    @Body() dto: CreateItemCategoryDto,
  ) {
    return this.itemCategoriesService.createCategory(req, toInternalGroupId(publicGroupId), dto);
  }

  /**
   * Updates a shop item category.
   * PATCH /groups/:groupId/item-categories/:categoryId
   */
  @Patch(':groupId/item-categories/:categoryId')
  @HttpCode(HttpStatus.OK)
  updateItemCategory(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Param('categoryId', ParseIntPipe) categoryId: number,
    @Req() req: Request,
    @Body() dto: UpdateItemCategoryDto,
  ) {
    return this.itemCategoriesService.updateCategory(
      req,
      toInternalGroupId(publicGroupId),
      categoryId,
      dto,
    );
  }

  /**
   * Deletes a shop item category. Items in the category become uncategorized.
   * DELETE /groups/:groupId/item-categories/:categoryId
   */
  @Delete(':groupId/item-categories/:categoryId')
  @HttpCode(HttpStatus.OK)
  deleteItemCategory(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Param('categoryId', ParseIntPipe) categoryId: number,
    @Req() req: Request,
    @Body() body: { auth?: string },
  ) {
    return this.itemCategoriesService.deleteCategory(
      req,
      toInternalGroupId(publicGroupId),
      categoryId,
      body?.auth,
    );
  }

  // ========================================
  // SHOP ITEMS CRUD
  // ========================================

  @Get(':groupId/shop-items')
  @HttpCode(HttpStatus.OK)
  getShopItems(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Req() req: Request,
    @Query('auth') auth: string | undefined,
  ) {
    return this.shopItemsService.getItemsForGroup(req, toInternalGroupId(publicGroupId), auth);
  }

  @Post(':groupId/shop-items')
  @HttpCode(HttpStatus.CREATED)
  createShopItem(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Req() req: Request,
    @Body() dto: CreateShopItemDto,
  ) {
    return this.shopItemsService.createItem(req, toInternalGroupId(publicGroupId), dto);
  }

  @Post(':groupId/shop-items/from-template')
  @HttpCode(HttpStatus.CREATED)
  createShopItemFromTemplate(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Req() req: Request,
    @Body() dto: CreateShopItemFromTemplateDto,
  ) {
    return this.shopItemsService.createItemFromTemplate(req, toInternalGroupId(publicGroupId), dto);
  }

  @Patch(':groupId/shop-items/:itemId')
  @HttpCode(HttpStatus.OK)
  updateShopItem(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Req() req: Request,
    @Body() dto: UpdateShopItemDto,
  ) {
    return this.shopItemsService.updateItem(req, toInternalGroupId(publicGroupId), itemId, dto);
  }

  @Delete(':groupId/shop-items/:itemId')
  @HttpCode(HttpStatus.OK)
  deleteShopItem(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Req() req: Request,
    @Body() body: { auth?: string },
  ) {
    return this.shopItemsService.deleteItem(req, toInternalGroupId(publicGroupId), itemId, body?.auth);
  }

  // ========================================
  // SHOP ITEMS - STUDENT ACTIONS
  // ========================================

  @Post(':groupId/shop-items/:itemId/buy')
  @HttpCode(HttpStatus.OK)
  buyShopItem(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Req() req: Request,
    @Body() body: { auth?: string },
  ) {
    return this.shopStudentService.buyItem(req, toInternalGroupId(publicGroupId), itemId, body?.auth);
  }

  @Get(':groupId/inventory')
  @HttpCode(HttpStatus.OK)
  getStudentInventory(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Req() req: Request,
    @Query('auth') auth: string | undefined,
  ) {
    return this.shopStudentService.getInventory(req, toInternalGroupId(publicGroupId), auth);
  }

  @Post(':groupId/inventory/:itemId/use')
  @HttpCode(HttpStatus.OK)
  useInventoryItem(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Req() req: Request,
    @Body() body: { auth?: string },
  ) {
    return this.shopStudentService.useItem(req, toInternalGroupId(publicGroupId), itemId, body?.auth);
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
