import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { GAMIFICATION_SCHEMA } from '../../constants/database-schema-constants';

/**
 * Tracks items bought by a student in a specific enrollment (`gamification.earned_items`).
 */
@Entity({ schema: GAMIFICATION_SCHEMA, name: 'earned_items' })
@Unique('earned_items_enrollment_item_unique', ['enrollmentId', 'itemId'])
export class EarnedItemEntity {
  @PrimaryGeneratedColumn()
  id: number;

  /** FK to `gamification.enrollments.id`. */
  @Column({ name: 'enrollment_id', type: 'integer', nullable: false })
  enrollmentId: number;

  /** FK to `gamification.items.id`. */
  @Column({ name: 'item_id', type: 'integer', nullable: false })
  itemId: number;

  /** Quantity of the item owned by the student. */
  @Column({ name: 'quantity', type: 'integer', nullable: false, default: 1 })
  quantity: number;
}
