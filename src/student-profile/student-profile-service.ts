import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { Request } from 'express';
import { DataSource } from 'typeorm';

import { SessionService } from '../auth/session/session.service';
import { GROUP_RESPONSE_GROUP_ID_OFFSET } from '../constants/group-api-constants';
import { LECTURER_ROLE_NAME, STUDENT_ROLE_NAME } from '../constants/role-name-constants';
import { UserRolesService } from '../user-roles/user-roles-service';

export type StudentProfileBadgeItem = {
  id: number;
  name: string;
  icon: string | null;
  rarity: string;
  storyDescription: string | null;
  educationalDescription: string | null;
  rewardAmount: number | null;
};

export type StudentProfileActivityItem = {
  id: number;
  name: string;
  stageId: number | null;
  stageName: string | null;
  storyDescription: string | null;
  educationalDescription: string | null;
  currency: number;
  completedAt: string | null;
};

export type StudentProfileResponseBody = {
  studentAccountId: number;
  groupId: number;
  nickname: string;
  name: string;
  surname: string;
  avatarId: number;
  avatarUrl: string | null;
  rankId: number | null;
  rankName: string | null;
  currency: number;
  totalEarned: number;
  badgesCount: number;
  purchasedItemsCount: number;
  usedItemsCount: number;
  lostLivesCount: number;
  groupCurrency: string | null;
  groupCurrencyEmoji: string | null;
  lives: number | null;
  livesIcon: number | null;
  livesEnabled: boolean;
  shopOpen: boolean;
  earnedBadges: StudentProfileBadgeItem[];
  completedActivities: StudentProfileActivityItem[];
};

type StudentProfileRow = {
  enrollmentId: number;
  studentAccountId: number;
  nickname: string | null;
  name: string | null;
  surname: string | null;
  avatarId: number | null;
  avatarUrl: string | null;
  currency: number | null;
  totalEarned: number | null;
  rankId: number | null;
  rankName: string | null;
  groupCurrency: string | null;
  groupCurrencyEmoji: string | null;
  lives: number | null;
  livesIcon: number | null;
  livesEnabled: boolean | string | number | null;
  shopOpen: boolean;
};

type EarnedBadgeRow = {
  id: number;
  name: string;
  icon: string | null;
  rarity: string | null;
  storyDescription: string | null;
  educationalDescription: string | null;
  rewardAmount: number | null;
};

type CompletedActivityRow = {
  id: number;
  name: string;
  stageId: number | null;
  stageName: string | null;
  storyDescription: string | null;
  educationalDescription: string | null;
  currency: number | null;
  completedAt: Date | string | null;
};

@Injectable()
export class StudentProfileService {
  constructor(
    private readonly sessionService: SessionService,
    private readonly userRolesService: UserRolesService,
    @InjectDataSource()
    private readonly dataSource: DataSource) {}

  async getStudentProfile(
    req: Request,
    publicGroupId: number,
    requestedStudentAccountId?: number,
  ): Promise<StudentProfileResponseBody | { error: string }> {
    const subject = await this.sessionService.resolveSubjectFromRequest(req, undefined);
    if (!subject) {
      return { error: 'Unauthorized' };
    }

    const internalGroupId =
      publicGroupId >= GROUP_RESPONSE_GROUP_ID_OFFSET
        ? publicGroupId - GROUP_RESPONSE_GROUP_ID_OFFSET
        : publicGroupId;

    let targetStudentAccountId: number;

    if (requestedStudentAccountId !== undefined) {
      const lecturerAccountId = await this.userRolesService.findAccountIdForRole(
        subject.userId,
        LECTURER_ROLE_NAME,
      );
      if (lecturerAccountId !== null) {
        const isOwner = await this.dataSource.query<{ id: number }[]>(
          `SELECT id FROM education.groups WHERE id = $1 AND teacher_account_id = $2`,
          [internalGroupId, lecturerAccountId],
        );
        if (!isOwner || isOwner.length === 0) {
          return { error: 'Forbidden' };
        }
        targetStudentAccountId = requestedStudentAccountId;
      } else {
        const studentAccountId = await this.userRolesService.findAccountIdForRole(
          subject.userId,
          STUDENT_ROLE_NAME,
        );
        if (studentAccountId === null || studentAccountId !== requestedStudentAccountId) {
          return { error: 'Unauthorized' };
        }
        targetStudentAccountId = studentAccountId;
      }
    } else {
      const studentAccountId = await this.userRolesService.findAccountIdForRole(
        subject.userId,
        STUDENT_ROLE_NAME,
      );
      if (studentAccountId === null) {
        return { error: 'Brak profilu studenta dla tego użytkownika' };
      }
      targetStudentAccountId = studentAccountId;
    }

    const rows = await this.dataSource.query<StudentProfileRow[]>(
      `SELECT
         e.id                         AS "enrollmentId",
         e.student_account_id         AS "studentAccountId",
         u.nickname                   AS "nickname",
         u.name                       AS "name",
         u.surname                    AS "surname",
         u.avatar_id                  AS "avatarId",
         av.image_url                 AS "avatarUrl",
         COALESCE(ss.currency, 0)     AS "currency",
         COALESCE(ss.total_earned, 0) AS "totalEarned",
         ss.rank_id                   AS "rankId",
         r.name                       AS "rankName",
         g.currency                   AS "groupCurrency",
         g.currency_emoji             AS "groupCurrencyEmoji",
         ss.lives                     AS "lives",
         g.lives_icon                 AS "livesIcon",
         g.lives_enabled              AS "livesEnabled",
         g.shop_open                  AS "shopOpen"
       FROM gamification.enrollments e
       JOIN auth.accounts a ON a.id = e.student_account_id
       JOIN auth.users u ON u.id = a.user_id
       LEFT JOIN auth.avatars av ON av.id = u.avatar_id
       LEFT JOIN gamification.student_stats ss ON ss.enrollment_id = e.id
       LEFT JOIN gamification.ranks r ON r.id = ss.rank_id
       JOIN education.groups g ON g.id = e.group_id
       WHERE e.group_id = $1 AND e.student_account_id = $2
       LIMIT 1`,
      [internalGroupId, targetStudentAccountId]);

    const row = rows[0];
    if (!row) {
      return { error: 'Student nie jest zapisany do tej grupy' };
    }

    const earnedBadgeRows = await this.dataSource.query<EarnedBadgeRow[]>(
      `SELECT
         b.id                         AS "id",
         b.name                       AS "name",
         b.icon                       AS "icon",
         b.rarity                     AS "rarity",
         b.story_description          AS "storyDescription",
         b.educational_description    AS "educationalDescription",
         b.reward_amount              AS "rewardAmount"
       FROM gamification.earned_badges eb
       JOIN gamification.badges b ON b.id = eb.badge_id
       WHERE eb.enrollment_id = $1
       ORDER BY b.id ASC`,
      [row.enrollmentId]);

    const earnedBadges: StudentProfileBadgeItem[] = earnedBadgeRows.map((badge) => ({
      id: badge.id,
      name: badge.name,
      icon: badge.icon,
      rarity: badge.rarity ?? 'common',
      storyDescription: badge.storyDescription,
      educationalDescription: badge.educationalDescription,
      rewardAmount: badge.rewardAmount,
    }));

    const completedActivityRows = await this.dataSource.query<CompletedActivityRow[]>(
      `SELECT
         a.id                         AS "id",
         a.name                       AS "name",
         a.stage_id                   AS "stageId",
         s.name                       AS "stageName",
         a.story_description          AS "storyDescription",
         a.educational_description    AS "educationalDescription",
         a.currency                   AS "currency",
         ab.date                      AS "completedAt"
       FROM analytics.activity_backlog ab
       JOIN education.activities a ON a.id = ab.activity_id
       LEFT JOIN education.stages s ON s.id = a.stage_id
       WHERE ab.group_id = $1 AND ab.account_id = $2
       ORDER BY ab.date DESC NULLS LAST, a.id ASC`,
      [internalGroupId, row.studentAccountId]);

    const completedActivities: StudentProfileActivityItem[] = completedActivityRows.map((activity) => ({
      id: activity.id,
      name: activity.name,
      stageId: activity.stageId,
      stageName: activity.stageName,
      storyDescription: activity.storyDescription,
      educationalDescription: activity.educationalDescription,
      currency: activity.currency ?? 0,
      completedAt: activity.completedAt ? new Date(activity.completedAt).toISOString() : null,
    }));

    const backlogRows = await this.dataSource.query<{ type: string; value: string | null }[]>(
      `SELECT type, value
       FROM analytics.backlog
       WHERE group_id = $1 AND account_id = $2 AND type IN ('SHOP_PURCHASE', 'ITEM_USED', 'LIVES_CHANGED')`,
      [internalGroupId, row.studentAccountId],
    );

    let purchasedItemsCount = 0;
    let usedItemsCount = 0;
    let lostLivesCount = 0;

    for (const entry of backlogRows) {
      if (entry.type === 'SHOP_PURCHASE') {
        purchasedItemsCount += 1;
      } else if (entry.type === 'ITEM_USED') {
        usedItemsCount += 1;
      } else if (entry.type === 'LIVES_CHANGED' && entry.value) {
        try {
          const parsed = typeof entry.value === 'string' ? JSON.parse(entry.value) : entry.value;
          const delta = typeof parsed.delta === 'number' ? parsed.delta : parseInt(parsed.delta, 10);
          if (Number.isFinite(delta) && delta < 0) {
            lostLivesCount += Math.abs(delta);
          }
        } catch {
          // ignore malformed backlog payload
        }
      }
    }

    return {
      studentAccountId: row.studentAccountId,
      groupId: publicGroupId,
      nickname: row.nickname ?? '',
      name: row.name ?? '',
      surname: row.surname ?? '',
      avatarId: row.avatarId ?? 0,
      avatarUrl: row.avatarUrl,
      rankId: row.rankId,
      rankName: row.rankName,
      currency: row.currency ?? 0,
      totalEarned: row.totalEarned ?? 0,
      badgesCount: earnedBadges.length,
      purchasedItemsCount,
      usedItemsCount,
      lostLivesCount,
      groupCurrency: row.groupCurrency,
      groupCurrencyEmoji: row.groupCurrencyEmoji,
      lives: row.lives,
      livesIcon: row.livesIcon,
      livesEnabled: row.livesEnabled === true || (row.livesEnabled as unknown) === 't' || (row.livesEnabled as unknown) === 1,
      shopOpen: row.shopOpen === true || row.shopOpen === ('t' as unknown) || row.shopOpen === (1 as unknown),
      earnedBadges,
      completedActivities,
    };
  }
}
