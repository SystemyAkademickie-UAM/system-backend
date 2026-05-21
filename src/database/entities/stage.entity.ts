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
}
