import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import {
  EDUCATION_GROUP_VARCHAR_MAX_LENGTH,
  GAMIFICATION_BADGE_NAME_MAX_LENGTH,
} from '../../constants/database-entity-constants';
import { GAMIFICATION_SCHEMA } from '../../constants/database-schema-constants';

/**
 * Shop catalog item for a course group (`gamification.items`).
 * `imageRef` stores a drive UUID from `POST /api/drive` (same pattern as `education.groups.image_ref`).
 */
@Entity({ schema: GAMIFICATION_SCHEMA, name: 'items' })
export class ItemEntity {
  @PrimaryGeneratedColumn()
  id: number;

  /** FK to `education.groups.id`. */
  @Column({ name: 'group_id', type: 'integer', nullable: false })
  groupId: number;

  /** FK to `gamification.item_categories.id` (nullable). */
  @Column({ name: 'category_id', type: 'integer', nullable: true })
  categoryId: number | null;

  /** Drive object UUID (`GET /api/drive/:driveRef`). */
  @Column({ name: 'image_ref', type: 'varchar', length: EDUCATION_GROUP_VARCHAR_MAX_LENGTH, nullable: true })
  imageRef: string | null;

  @Column({ name: 'name', type: 'varchar', length: GAMIFICATION_BADGE_NAME_MAX_LENGTH, nullable: false })
  name: string;

  @Column({ name: 'educational_description', type: 'text', nullable: true })
  educationalDescription: string | null;
}
