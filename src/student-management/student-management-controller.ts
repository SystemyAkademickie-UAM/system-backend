import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { toInternalGroupId } from '../constants/group-api-constants';
import { ReportsService } from './reports-service';
import { StudentBadgesService } from './student-badges-service';
import { StudentManagementService } from './student-management-service';
import { StudentProgressService } from './student-progress-service';
import { ShopStudentService } from '../gamification/shop-student-service';
import { BulkUpdateStudentsDto } from './dto/bulk-update-student.dto';
import { BulkUpdateLivesDto } from './dto/bulk-update-lives.dto';
import { SetActivityCompletionsDto } from './dto/set-activity-completions.dto';

/**
 * Participant management API for lecturers (Panel Zarządzania Uczestnikami).
 * All endpoints require lecturer authorization.
 */
@ApiTags('Student management')
@Controller('groups')
export class StudentManagementController {
  constructor(
    private readonly studentManagementService: StudentManagementService,
    private readonly studentBadgesService: StudentBadgesService,
    private readonly studentProgressService: StudentProgressService,
    private readonly reportsService: ReportsService,
    private readonly shopStudentService: ShopStudentService) {}

  // ── Part 1: Student list table ──────────────────────────────────────

  /**
   * Returns participants enrolled in the group with their stats.
   */
  @Get(':groupId/students')
  @ApiOperation({ summary: 'List participants enrolled in the group with their stats' })
  getStudents(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Req() req: Request) {
    return this.studentManagementService.getStudents(req, toInternalGroupId(publicGroupId));
  }

  /**
   * Returns limited participant list accessible to enrolled students and lecturers.
   */
  @Get(':groupId/participants')
  @ApiOperation({ summary: 'List limited participant data for enrolled students and lecturers' })
  getParticipants(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Req() req: Request) {
    return this.studentManagementService.getParticipants(req, toInternalGroupId(publicGroupId));
  }

  /**
   * Bulk-updates student stats (currency, totalEarned, rankId) from the table save button.
   */
  @Patch(':groupId/students/bulk-update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk-update student stats (currency, totalEarned, rankId)' })
  bulkUpdate(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Req() req: Request,
    @Body() dto: BulkUpdateStudentsDto) {
    return this.studentManagementService.bulkUpdate(req, toInternalGroupId(publicGroupId), dto);
  }

  /**
   * Removes a student from the group (cascading related data transactionally).
   */
  @Delete(':groupId/students/:accountId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a student from the group (cascading related data)' })
  removeStudent(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Param('accountId', ParseIntPipe) accountId: number,
    @Req() req: Request) {
    return this.studentManagementService.removeStudent(req, toInternalGroupId(publicGroupId), accountId);
  }

  /**
   * Increases student lives by 1 (+1).
   */
  @Post(':groupId/students/:accountId/lives/increment')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Increase student lives by 1' })
  incrementLives(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Param('accountId', ParseIntPipe) accountId: number,
    @Req() req: Request) {
    return this.studentManagementService.incrementLives(req, toInternalGroupId(publicGroupId), accountId);
  }

  /**
   * Decreases student lives by 1 (-1).
   */
  @Post(':groupId/students/:accountId/lives/decrement')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Decrease student lives by 1' })
  decrementLives(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Param('accountId', ParseIntPipe) accountId: number,
    @Req() req: Request) {
    return this.studentManagementService.decrementLives(req, toInternalGroupId(publicGroupId), accountId);
  }

  /**
   * Bulk-updates lives for multiple students (PATCH, arbitrary delta, livesMax-capped).
   */
  @Patch(':groupId/students/lives/bulk-update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk-update lives for multiple students (arbitrary delta, capped to group livesMax)' })
  bulkUpdateLives(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Req() req: Request,
    @Body() dto: BulkUpdateLivesDto) {
    return this.studentManagementService.bulkUpdateLives(req, toInternalGroupId(publicGroupId), dto);
  }

  // ── Part 2: Badge management pop-up ─────────────────────────────────

  /**
   * Returns all group badges with an `isEarned` flag for the specified student.
   */
  @Get(':groupId/students/:accountId/badges')
  @ApiOperation({ summary: 'List group badges with an isEarned flag for the student' })
  getStudentBadges(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Param('accountId', ParseIntPipe) accountId: number,
    @Req() req: Request) {
    return this.studentBadgesService.getStudentBadges(
      req,
      toInternalGroupId(publicGroupId),
      accountId);
  }

  /**
   * Toggles (grants/revokes) a badge for the student, adjusting currency reward.
   */
  @Post(':groupId/students/:accountId/badges/:badgeId/toggle')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Toggle (grant/revoke) a badge for the student' })
  toggleBadge(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Param('accountId', ParseIntPipe) accountId: number,
    @Param('badgeId', ParseIntPipe) badgeId: number,
    @Req() req: Request) {
    return this.studentBadgesService.toggleBadge(
      req,
      toInternalGroupId(publicGroupId),
      accountId,
      badgeId);
  }

  // ── Part 3: Progress management pop-up ──────────────────────────────

  /**
   * Returns account IDs that completed a group activity (single query on activity_backlog).
   */
  @Get(':groupId/activities/:activityId/completions')
  @ApiOperation({ summary: 'List account IDs that completed a group activity' })
  getActivityCompletions(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Param('activityId', ParseIntPipe) activityId: number,
    @Req() req: Request) {
    return this.studentProgressService.getActivityCompletions(
      req,
      toInternalGroupId(publicGroupId),
      activityId);
  }

  /**
   * Sets the target completion set for a group activity (transactional grant/revoke).
   */
  @Patch(':groupId/activities/:activityId/completions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set the target completion set for a group activity' })
  setActivityCompletions(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Param('activityId', ParseIntPipe) activityId: number,
    @Req() req: Request,
    @Body() dto: SetActivityCompletionsDto) {
    return this.studentProgressService.setActivityCompletions(
      req,
      toInternalGroupId(publicGroupId),
      activityId,
      dto);
  }

  /**
   * Returns inventory (earned shop items) for the specified student.
   */
  @Get(':groupId/students/:accountId/inventory')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get inventory for a specific student in the group' })
  getStudentInventory(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Param('accountId', ParseIntPipe) accountId: number,
    @Req() req: Request) {
    return this.shopStudentService.getInventoryForAccount(
      req,
      toInternalGroupId(publicGroupId),
      accountId);
  }

  /**
   * Returns the progress tree (stages → activities with `isCompleted` flags).
   */
  @Get(':groupId/students/:accountId/progress')
  @ApiOperation({ summary: 'Get the progress tree (stages and activities with completion flags)' })
  getStudentProgress(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Param('accountId', ParseIntPipe) accountId: number,
    @Req() req: Request) {
    return this.studentProgressService.getStudentProgress(
      req,
      toInternalGroupId(publicGroupId),
      accountId);
  }

  /**
   * Toggles the completion status of an activity for the student.
   */
  @Post(':groupId/students/:accountId/activities/:activityId/toggle')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Toggle the completion status of an activity for the student' })
  toggleActivity(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Param('accountId', ParseIntPipe) accountId: number,
    @Param('activityId', ParseIntPipe) activityId: number,
    @Req() req: Request) {
    return this.studentProgressService.toggleActivity(
      req,
      toInternalGroupId(publicGroupId),
      accountId,
      activityId);
  }

  // ── Part 4: CSV reports ─────────────────────────────────────────────

  /**
   * Downloads a CSV report for the entire group (all students × all stages/activities).
   */
  @Get(':groupId/reports/group')
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="report-group.csv"')
  @ApiOperation({ summary: 'Download CSV report for the entire group' })
  getGroupReport(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Req() req: Request): Promise<string> {
    return this.reportsService.generateGroupReport(req, toInternalGroupId(publicGroupId));
  }

  /**
   * Downloads a CSV report for a single stage (all students × activities from that stage).
   */
  @Get(':groupId/reports/stage/:stageId')
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="report-stage.csv"')
  @ApiOperation({ summary: 'Download CSV report for a single stage' })
  getStageReport(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Param('stageId', ParseIntPipe) stageId: number,
    @Req() req: Request): Promise<string> {
    return this.reportsService.generateStageReport(
      req,
      toInternalGroupId(publicGroupId),
      stageId);
  }

  /**
   * Downloads a CSV report for a single student (all stages/activities for one student).
   */
  @Get(':groupId/reports/student/:accountId')
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="report-student.csv"')
  @ApiOperation({ summary: 'Download CSV report for a single student' })
  getStudentReport(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Param('accountId', ParseIntPipe) accountId: number,
    @Req() req: Request): Promise<string> {
    return this.reportsService.generateStudentReport(
      req,
      toInternalGroupId(publicGroupId),
      accountId);
  }
}
