import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import {
  GAMIFICATION_RANK_NAME_MAX_LENGTH,
  GAMIFICATION_ICON_MAX_LENGTH,
} from '../../constants/database-entity-constants';
import { GAMIFICATION_SCHEMA } from '../../constants/database-schema-constants';

/**
 * Rank definition for a course group (`gamification.ranks`).
 */
@Entity({ schema: GAMIFICATION_SCHEMA, name: 'ranks' })
export class RankEntity {
  @PrimaryGeneratedColumn()
  id: number;

  /** FK to `education.groups.id`. */
  @Column({ name: 'group_id', type: 'integer', nullable: true })
  groupId: number | null;

  @Column({ name: 'name', type: 'varchar', length: GAMIFICATION_RANK_NAME_MAX_LENGTH, nullable: false })
  name: string;

  @Column({ name: 'required_points', type: 'integer', nullable: false })
  requiredPoints: number;

  @Column({ name: 'icon', type: 'varchar', length: GAMIFICATION_ICON_MAX_LENGTH, nullable: true })
  icon: string | null;

  @Column({ name: 'story_description', type: 'text', nullable: true })
  storyDescription: string | null;

  @Column({ name: 'store_discount', type: 'integer', nullable: true, default: 0 })
  storeDiscount: number | null;

  @Column({ name: 'unique_store_items', type: 'text', array: true, nullable: true })
  uniqueStoreItems: string[] | null;

  @Column({ name: 'discount', type: 'decimal', precision: 5, scale: 2, nullable: true, default: 0 })
  discount: number;
}
