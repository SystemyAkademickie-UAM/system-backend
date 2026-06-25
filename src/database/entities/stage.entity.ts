import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { EDUCATION_SCHEMA } from '../../constants/database-schema-constants';

/** Max length for `education.stages.name`. */
export const EDUCATION_STAGE_NAME_MAX_LENGTH = 255;

/**
 * Stage within a group (`education.stages`).
 */
@Entity({ schema: EDUCATION_SCHEMA, name: 'stages' })
export class StageEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'group_id', type: 'integer', nullable: false })
  groupId: number;

  @Column({ name: 'name', type: 'varchar', length: EDUCATION_STAGE_NAME_MAX_LENGTH, nullable: false })
  name: string;

  /** Stage visibility: 0=hidden, 1=visible, 2=unlockable */
  @Column({ name: 'visibility_status', type: 'integer', default: 0 })
  visibilityStatus: number;

  /** Order for rendering in UI tree */
  @Column({ name: 'display_order', type: 'integer', nullable: true })
  displayOrder: number | null;
}
