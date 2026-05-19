import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { EDUCATION_SCHEMA } from '../../constants/database-schema-constants';

/** Max length for `education.activities.name`. */
export const EDUCATION_ACTIVITY_NAME_MAX_LENGTH = 255;

/**
 * Activity within a stage (`education.activities`).
 */
@Entity({ schema: EDUCATION_SCHEMA, name: 'activities' })
export class ActivityEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'stage_id', type: 'integer', nullable: false })
  stageId: number;

  @Column({ name: 'name', type: 'varchar', length: EDUCATION_ACTIVITY_NAME_MAX_LENGTH, nullable: false })
  name: string;

  @Column({ name: 'currency', type: 'integer', nullable: false })
  currency: number;

  @Column({ name: 'educational_description', type: 'text', nullable: false })
  educationalDescription: string;

  @Column({ name: 'story_description', type: 'text', nullable: false })
  storyDescription: string;
}
