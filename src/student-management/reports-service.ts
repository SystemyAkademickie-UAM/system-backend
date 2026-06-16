import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { DataSource, Repository } from 'typeorm';

import { AuthTokenSessionService } from '../auth/api-token/auth-token-session-service';
import { LECTURER_ROLE_NAME } from '../constants/role-name-constants';

import { EnrollmentEntity } from '../database/entities/enrollment.entity';
import { GroupEntity } from '../database/entities/group.entity';
import { StageEntity } from '../database/entities/stage.entity';
import { UserRolesService } from '../user-roles/user-roles-service';

/** UTF-8 BOM prefix for Excel compatibility. */
const CSV_BOM = '\uFEFF';

/** CSV field separator — semicolon works better with Polish Excel locale. */
const CSV_SEPARATOR = ';';

/** Student row from the enrollment join query. */
interface StudentRow {
  accountId: number;
  name: string;
  surname: string;
  nickname: string;
}

/** Flat stage + activity pair from the joined query. */
interface StageActivityRow {
  stageId: number;
  stageName: string;
  activityId: number;
  activityName: string;
}

/**
 * Generates CSV reports for lecturer download.
 *
 * Three report scopes:
 * - **Group** — all students × all stages/activities.
 * - **Stage** — all students × activities from a single stage.
 * - **Student** — one student × all stages/activities.
 */
@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly authTokenSessionService: AuthTokenSessionService,
    private readonly userRolesService: UserRolesService,
    private readonly dataSource: DataSource,
    @InjectRepository(StageEntity)
    private readonly stageRepository: Repository<StageEntity>,
    @InjectRepository(EnrollmentEntity)
    private readonly enrollmentRepository: Repository<EnrollmentEntity>,
    @InjectRepository(GroupEntity)
    private readonly groupRepository: Repository<GroupEntity>,
  ) {}

  /**
   * Generates a CSV report for the entire group.
   * Rows = students, columns = stage/activity pairs, values = 1 (completed) or 0.
   */
  async generateGroupReport(req: Request, groupId: number): Promise<string> {
    await this.assertLecturerOwner(req, groupId);
    const students = await this.fetchStudents(groupId);
    const stageActivities = await this.fetchStageActivities(groupId);
    const completions = await this.fetchCompletions(groupId);
    return this.buildMatrixCsv(students, stageActivities, completions);
  }

  /**
   * Generates a CSV report for a single stage within the group.
   * Rows = students, columns = activities from that stage, values = 1 or 0.
   */
  async generateStageReport(
    req: Request,
    groupId: number,
    stageId: number,
  ): Promise<string> {
    await this.assertLecturerOwner(req, groupId);
    await this.assertStageInGroup(groupId, stageId);
    const students = await this.fetchStudents(groupId);
    const stageActivities = await this.fetchStageActivities(groupId, stageId);
    const completions = await this.fetchCompletions(groupId);
    return this.buildMatrixCsv(students, stageActivities, completions);
  }

  /**
   * Generates a CSV report for a single student across all stages/activities.
   * Rows = stage/activity pairs, single value column = 1 or 0.
   */
  async generateStudentReport(
    req: Request,
    groupId: number,
    accountId: number,
  ): Promise<string> {
    await this.assertLecturerOwner(req, groupId);
    await this.assertEnrollmentExists(groupId, accountId);
    const student = await this.fetchSingleStudent(groupId, accountId);
    const stageActivities = await this.fetchStageActivities(groupId);
    const completions = await this.fetchCompletions(groupId, accountId);
    return this.buildStudentCsv(student, stageActivities, completions);
  }

  // ── Data fetching ──────────────────────────────────────────────────

  private async fetchStudents(groupId: number): Promise<StudentRow[]> {
    return this.dataSource.query<StudentRow[]>(
      `SELECT
         a.id        AS "accountId",
         u.name      AS "name",
         u.surname   AS "surname",
         u.nickname  AS "nickname"
       FROM gamification.enrollments e
       JOIN auth.accounts a ON a.id = e.student_account_id
       JOIN auth.users u    ON u.id = a.user_id
       WHERE e.group_id = $1
       ORDER BY u.surname, u.name`,
      [groupId],
    );
  }

  private async fetchSingleStudent(
    groupId: number,
    accountId: number,
  ): Promise<StudentRow> {
    const rows = await this.dataSource.query<StudentRow[]>(
      `SELECT
         a.id        AS "accountId",
         u.name      AS "name",
         u.surname   AS "surname",
         u.nickname  AS "nickname"
       FROM gamification.enrollments e
       JOIN auth.accounts a ON a.id = e.student_account_id
       JOIN auth.users u    ON u.id = a.user_id
       WHERE e.group_id = $1 AND a.id = $2
       LIMIT 1`,
      [groupId, accountId],
    );
    if (rows.length === 0) {
      throw new NotFoundException(
        `Student with accountId ${accountId} is not enrolled in group ${groupId}`,
      );
    }
    return rows[0];
  }

  private async fetchStageActivities(
    groupId: number,
    stageId?: number,
  ): Promise<StageActivityRow[]> {
    const params: number[] = [groupId];
    let stageFilter = '';
    if (stageId !== undefined) {
      stageFilter = ' AND s.id = $2';
      params.push(stageId);
    }
    return this.dataSource.query<StageActivityRow[]>(
      `SELECT
         s.id   AS "stageId",
         s.name AS "stageName",
         a.id   AS "activityId",
         a.name AS "activityName"
       FROM education.stages s
       JOIN education.activities a ON a.stage_id = s.id
       WHERE s.group_id = $1${stageFilter}
       ORDER BY s.id ASC, a.id ASC`,
      params,
    );
  }

  private async fetchCompletions(
    groupId: number,
    accountId?: number,
  ): Promise<Set<string>> {
    const params: number[] = [groupId];
    let accountFilter = '';
    if (accountId !== undefined) {
      accountFilter = ' AND account_id = $2';
      params.push(accountId);
    }
    const rows = await this.dataSource.query<
      Array<{ account_id: number; activity_id: number }>
    >(
      `SELECT account_id, activity_id
       FROM analytics.activity_backlog
       WHERE group_id = $1${accountFilter}`,
      params,
    );
    const set = new Set<string>();
    for (const row of rows) {
      set.add(`${row.account_id}:${row.activity_id}`);
    }
    return set;
  }

  // ── CSV building ───────────────────────────────────────────────────

  private buildMatrixCsv(
    students: StudentRow[],
    stageActivities: StageActivityRow[],
    completions: Set<string>,
  ): string {
    const header = [
      'Student',
      ...stageActivities.map(
        (sa) => `${sa.stageName} > ${sa.activityName}`,
      ),
    ];
    const rows: string[][] = [];
    for (const student of students) {
      const studentLabel = this.formatStudentName(student);
      const cells = stageActivities.map((sa) =>
        completions.has(`${student.accountId}:${sa.activityId}`) ? '1' : '0',
      );
      rows.push([studentLabel, ...cells]);
    }
    return this.serializeCsv(header, rows);
  }

  private buildStudentCsv(
    student: StudentRow,
    stageActivities: StageActivityRow[],
    completions: Set<string>,
  ): string {
    const studentLabel = this.formatStudentName(student);
    const header = ['Student', 'Stage', 'Activity', 'Completed'];
    const rows: string[][] = [];
    for (const sa of stageActivities) {
      const isCompleted = completions.has(
        `${student.accountId}:${sa.activityId}`,
      )
        ? '1'
        : '0';
      rows.push([studentLabel, sa.stageName, sa.activityName, isCompleted]);
    }
    return this.serializeCsv(header, rows);
  }

  private serializeCsv(header: string[], rows: string[][]): string {
    const escapedHeader = header.map((h) => this.escapeCsvField(h));
    const escapedRows = rows.map((row) =>
      row.map((cell) => this.escapeCsvField(cell)),
    );
    const lines = [
      escapedHeader.join(CSV_SEPARATOR),
      ...escapedRows.map((row) => row.join(CSV_SEPARATOR)),
    ];
    return CSV_BOM + lines.join('\r\n') + '\r\n';
  }

  private escapeCsvField(value: string): string {
    let escaped = value;
    if (/^[=+\-@\t\r]/.test(escaped)) {
      escaped = "'" + escaped;
    }
    if (
      escaped.includes(CSV_SEPARATOR) ||
      escaped.includes('"') ||
      escaped.includes('\n') ||
      escaped.includes('\r')
    ) {
      return `"${escaped.replace(/"/g, '""')}"`;
    }
    return escaped;
  }

  private formatStudentName(student: StudentRow): string {
    const fullName = `${student.surname} ${student.name}`.trim();
    if (student.nickname && student.nickname !== fullName) {
      return `${fullName} (${student.nickname})`;
    }
    return fullName;
  }

  // ── Authorization & validation ─────────────────────────────────────

  private async assertLecturerOwner(
    req: Request,
    groupId: number,
  ): Promise<void> {
    const subject =
      await this.authTokenSessionService.resolveSubjectSoftFromRequest(req);
    if (!subject) {
      throw new ForbiddenException('Not authorized');
    }
    const isLecturer = await this.userRolesService.userHasRole(
      subject.userId,
      LECTURER_ROLE_NAME,
    );
    if (!isLecturer) {
      throw new ForbiddenException('Not authorized');
    }
    const lecturerAccountId = await this.userRolesService.findAccountIdForRole(
      subject.userId,
      LECTURER_ROLE_NAME,
    );
    if (lecturerAccountId === null) {
      throw new ForbiddenException('Not authorized');
    }
    const isOwner = await this.groupRepository.exist({
      where: { id: groupId, teacherAccountId: lecturerAccountId },
    });
    if (!isOwner) {
      throw new ForbiddenException('Not authorized to manage this group');
    }
  }

  private async assertStageInGroup(
    groupId: number,
    stageId: number,
  ): Promise<void> {
    const exists = await this.stageRepository.exist({
      where: { id: stageId, groupId },
    });
    if (!exists) {
      throw new NotFoundException(
        `Stage ${stageId} not found in group ${groupId}`,
      );
    }
  }

  private async assertEnrollmentExists(
    groupId: number,
    accountId: number,
  ): Promise<void> {
    const exists = await this.enrollmentRepository.exist({
      where: { groupId, studentAccountId: accountId },
    });
    if (!exists) {
      throw new NotFoundException(
        `Student with accountId ${accountId} is not enrolled in group ${groupId}`,
      );
    }
  }
}
