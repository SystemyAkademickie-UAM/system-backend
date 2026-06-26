import { Column, Entity, PrimaryColumn } from 'typeorm';

import { GAMIFICATION_SCHEMA } from '../../constants/database-schema-constants';

/**
 * Many-to-many link between shop items and item categories.
 */
@Entity({ schema: GAMIFICATION_SCHEMA, name: 'item_category_links' })
export class ItemCategoryLinkEntity {
  @PrimaryColumn({ name: 'item_id', type: 'integer' })
  itemId: number;

  @PrimaryColumn({ name: 'category_id', type: 'integer' })
  categoryId: number;

  @Column({ name: 'display_order', type: 'integer', nullable: false, default: 0 })
  displayOrder: number;
}
