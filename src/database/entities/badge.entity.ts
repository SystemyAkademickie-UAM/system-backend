import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import {
  GAMIFICATION_BADGE_NAME_MAX_LENGTH,
  GAMIFICATION_ICON_MAX_LENGTH,
} from '../../constants/database-entity-constants';
import { GAMIFICATION_SCHEMA } from '../../constants/database-schema-constants';

/**
 * Badge definition for a course group (`gamification.badges`).
 */
@Entity({ schema: GAMIFICATION_SCHEMA, name: 'badges' })
export class BadgeEntity {
  @PrimaryGeneratedColumn()
  id: number;

  /** FK to `education.groups.id`. */
  @Column({ name: 'group_id', type: 'integer', nullable: true })
  groupId: number | null;

  @Column({ name: 'name', type: 'varchar', length: GAMIFICATION_BADGE_NAME_MAX_LENGTH, nullable: false })
  name: string;

  @Column({ name: 'educational_description', type: 'text', nullable: true })
  educationalDescription: string | null;

  @Column({ name: 'icon', type: 'varchar', length: GAMIFICATION_ICON_MAX_LENGTH, nullable: true })
  icon: string | null;

  @Column({ name: 'story_description', type: 'text', nullable: true })
  storyDescription: string | null;

  @Column({ name: 'reward_amount', type: 'integer', nullable: true, default: 0 })
  rewardAmount: number | null;

  @Column({ name: 'rarity', type: 'varchar', length: 20, default: 'common' })
  rarity: string;
}

export enum BadgeRarity {
  COMMON = 'common',
  UNCOMMON = 'uncommon',
  RARE = 'rare',
  EPIC = 'epic',
}
