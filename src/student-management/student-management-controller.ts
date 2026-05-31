import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';

import { toInternalGroupId } from '../constants/group-api-constants';
import { StudentBadgesService } from './student-badges-service';
import { StudentManagementService } from './student-management-service';
import { StudentProgressService } from './student-progress-service';
import { BulkUpdateStudentsDto } from './dto/bulk-update-student.dto';
import { SetActivityCompletionsDto } from './dto/set-activity-completions.dto';

/**
 * Participant management API for lecturers (Panel Zarządzania Uczestnikami).
 * All endpoints require lecturer authorization.
 */
@Controller('groups')
export class StudentManagementController {
  constructor(
    private readonly studentManagementService: StudentManagementService,
    private readonly studentBadgesService: StudentBadgesService,
    private readonly studentProgressService: StudentProgressService,
  ) {}

  // ── Part 1: Student list table ──────────────────────────────────────

  /**
   * Returns participants enrolled in the group with their stats.
   */
  @Get(':groupId/students')
  getStudents(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Req() req: Request,
  ) {
    return this.studentManagementService.getStudents(req, toInternalGroupId(publicGroupId));
  }

  /**
   * Bulk-updates student stats (currency, totalEarned, rankId) from the table save button.
   */
  @Patch(':groupId/students/bulk-update')
  @HttpCode(HttpStatus.OK)
  bulkUpdate(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Req() req: Request,
    @Body() dto: BulkUpdateStudentsDto,
  ) {
    return this.studentManagementService.bulkUpdate(req, toInternalGroupId(publicGroupId), dto);
  }

  /**
   * Removes a student from the group (cascading related data transactionally).
   */
  @Delete(':groupId/students/:accountId')
  @HttpCode(HttpStatus.OK)
  removeStudent(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Param('accountId', ParseIntPipe) accountId: number,
    @Req() req: Request,
  ) {
    return this.studentManagementService.removeStudent(req, toInternalGroupId(publicGroupId), accountId);
  }

  // ── Part 2: Badge management pop-up ─────────────────────────────────

  /**
   * Returns all group badges with an `isEarned` flag for the specified student.
   */
  @Get(':groupId/students/:accountId/badges')
  getStudentBadges(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Param('accountId', ParseIntPipe) accountId: number,
    @Req() req: Request,
  ) {
    return this.studentBadgesService.getStudentBadges(
      req,
      toInternalGroupId(publicGroupId),
      accountId,
    );
  }

  /**
   * Toggles (grants/revokes) a badge for the student, adjusting currency reward.
   */
  @Post(':groupId/students/:accountId/badges/:badgeId/toggle')
  @HttpCode(HttpStatus.OK)
  toggleBadge(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Param('accountId', ParseIntPipe) accountId: number,
    @Param('badgeId', ParseIntPipe) badgeId: number,
    @Req() req: Request,
  ) {
    return this.studentBadgesService.toggleBadge(
      req,
      toInternalGroupId(publicGroupId),
      accountId,
      badgeId,
    );
  }

  // ── Part 3: Progress management pop-up ──────────────────────────────

  /**
   * Returns account IDs that completed a group activity (single query on activity_backlog).
   */
  @Get(':groupId/activities/:activityId/completions')
  getActivityCompletions(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Param('activityId', ParseIntPipe) activityId: number,
    @Req() req: Request,
  ) {
    return this.studentProgressService.getActivityCompletions(
      req,
      toInternalGroupId(publicGroupId),
      activityId,
    );
  }

  /**
   * Sets the target completion set for a group activity (transactional grant/revoke).
   */
  @Patch(':groupId/activities/:activityId/completions')
  @HttpCode(HttpStatus.OK)
  setActivityCompletions(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Param('activityId', ParseIntPipe) activityId: number,
    @Req() req: Request,
    @Body() dto: SetActivityCompletionsDto,
  ) {
    return this.studentProgressService.setActivityCompletions(
      req,
      toInternalGroupId(publicGroupId),
      activityId,
      dto,
    );
  }

  /**
   * Returns the progress tree (stages → activities with `isCompleted` flags).
   */
  @Get(':groupId/students/:accountId/progress')
  getStudentProgress(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Param('accountId', ParseIntPipe) accountId: number,
    @Req() req: Request,
  ) {
    return this.studentProgressService.getStudentProgress(
      req,
      toInternalGroupId(publicGroupId),
      accountId,
    );
  }

  /**
   * Toggles the completion status of an activity for the student.
   */
  @Post(':groupId/students/:accountId/activities/:activityId/toggle')
  @HttpCode(HttpStatus.OK)
  toggleActivity(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Param('accountId', ParseIntPipe) accountId: number,
    @Param('activityId', ParseIntPipe) activityId: number,
    @Req() req: Request,
  ) {
    return this.studentProgressService.toggleActivity(
      req,
      toInternalGroupId(publicGroupId),
      accountId,
      activityId,
    );
  }
}
