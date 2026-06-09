import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { GAMIFICATION_ITEM_CATEGORY_NAME_MAX_LENGTH } from '../../constants/database-entity-constants';
import { GAMIFICATION_SCHEMA } from '../../constants/database-schema-constants';

/**
 * Shop item category scoped to a course group (`gamification.item_categories`).
 */
@Entity({ schema: GAMIFICATION_SCHEMA, name: 'item_categories' })
export class ItemCategoryEntity {
  @PrimaryGeneratedColumn()
  id: number;

  /** FK to `education.groups.id`. */
  @Column({ name: 'group_id', type: 'integer', nullable: false })
  groupId: number;

  @Column({ name: 'name', type: 'varchar', length: GAMIFICATION_ITEM_CATEGORY_NAME_MAX_LENGTH, nullable: false })
  name: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'display_order', type: 'integer', nullable: true })
  displayOrder: number | null;
}
